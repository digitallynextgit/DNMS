// =============================================================================
// Storage accounts
// =============================================================================
// Several object-storage buckets instead of one block of settings. The app key
// is encrypted at rest and NEVER selected into a response - screens show whether
// it verifies, not what it is. Same rule as the project mailer's SMTP password.
// =============================================================================

import "server-only"

import { z } from "zod"
import { db } from "@/server/db"
import { encrypt, tryDecrypt } from "@/lib/crypto"
import { createAuditLog } from "@/lib/audit"
import { invalidateStorageClient } from "@/lib/storage"
import { ok, fail, runAction, serialize, type ActionResult } from "@/server/action-result"
import type { Session } from "next-auth"

export const storageAccountSchema = z.object({
  label: z.string().trim().min(2, "Give the account a name").max(80),
  endpoint: z.string().trim().url("Enter the S3 endpoint URL"),
  region: z.string().trim().min(1, "Region is required").max(40),
  bucket: z.string().trim().min(1, "Bucket is required").max(80),
  keyId: z.string().trim().min(1, "Key ID is required").max(200),
  /** Blank on edit = keep the stored key. */
  appKey: z.string().trim().max(400).optional().or(z.literal("")),
  isActive: z.boolean().default(true),
})
export type StorageAccountInput = z.infer<typeof storageAccountSchema>

/** Everything EXCEPT the key. Used for every read path. */
const SELECT = {
  id: true,
  label: true,
  endpoint: true,
  region: true,
  bucket: true,
  keyId: true,
  isDefault: true,
  isActive: true,
  lastVerifiedAt: true,
  lastError: true,
  createdAt: true,
} as const

export async function listStorageAccounts(): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const accounts = await db.storageAccount.findMany({
      select: SELECT,
      orderBy: [{ isDefault: "desc" }, { label: "asc" }],
    })
    return ok(serialize({ data: accounts }))
  })
}

export async function createStorageAccount(
  body: unknown,
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const input = storageAccountSchema.parse(body)
    if (!input.appKey) return fail("An application key is required", undefined, 422)

    const isFirst = (await db.storageAccount.count()) === 0
    const account = await db.storageAccount.create({
      data: {
        label: input.label,
        endpoint: input.endpoint,
        region: input.region,
        bucket: input.bucket,
        keyId: input.keyId,
        appKey: encrypt(input.appKey),
        isActive: input.isActive,
        // The first account has to be the default, or nothing can be uploaded.
        isDefault: isFirst,
        createdById: session.user.id,
      },
      select: SELECT,
    })

    await createAuditLog(session, {
      action: "storage_account:create",
      module: "admin",
      entityType: "StorageAccount",
      entityId: account.id,
      changes: { label: input.label, bucket: input.bucket, appKey: "***" },
    })
    return ok(serialize({ data: account }))
  })
}

export async function updateStorageAccount(
  id: string,
  body: unknown,
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const input = storageAccountSchema.parse(body)
    const existing = await db.storageAccount.findUnique({ where: { id }, select: { id: true } })
    if (!existing) return fail("Storage account not found", undefined, 404)

    const account = await db.storageAccount.update({
      where: { id },
      data: {
        label: input.label,
        endpoint: input.endpoint,
        region: input.region,
        bucket: input.bucket,
        keyId: input.keyId,
        // Blank means "keep the stored key" - it is never sent to the browser,
        // so blank cannot mean "clear it" without wiping working credentials
        // every time somebody renames an account.
        ...(input.appKey ? { appKey: encrypt(input.appKey) } : {}),
        isActive: input.isActive,
      },
      select: SELECT,
    })

    // Credentials may have changed under a cached client.
    invalidateStorageClient(id)
    invalidateStorageClient()

    await createAuditLog(session, {
      action: "storage_account:update",
      module: "admin",
      entityType: "StorageAccount",
      entityId: id,
      changes: {
        label: input.label,
        bucket: input.bucket,
        appKey: input.appKey ? "***changed***" : "***unchanged***",
      },
    })
    return ok(serialize({ data: account }))
  })
}

/**
 * Make one account the target for new uploads.
 *
 * Existing objects are NOT moved: an object key means nothing without the bucket
 * it lives in, so a "switch" that silently repointed old files would break every
 * document already stored. Only new writes follow the default.
 */
export async function setDefaultStorageAccount(
  id: string,
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const account = await db.storageAccount.findUnique({
      where: { id },
      select: { id: true, label: true, isActive: true },
    })
    if (!account) return fail("Storage account not found", undefined, 404)
    if (!account.isActive) {
      return fail("Turn the account on before making it the default", undefined, 409)
    }

    await db.$transaction([
      db.storageAccount.updateMany({ where: { isDefault: true }, data: { isDefault: false } }),
      db.storageAccount.update({ where: { id }, data: { isDefault: true } }),
    ])
    invalidateStorageClient()

    await createAuditLog(session, {
      action: "storage_account:set_default",
      module: "admin",
      entityType: "StorageAccount",
      entityId: id,
      changes: { label: account.label },
    })
    return ok(serialize({ data: { id } }))
  })
}

/**
 * Delete an account.
 *
 * Refuses for the default, and refuses the last one: either would leave the app
 * with nowhere to write, and the failure would only surface on somebody's next
 * upload. The FILES are left alone - deleting a row must not delete a bucket.
 */
export async function deleteStorageAccount(
  id: string,
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const account = await db.storageAccount.findUnique({
      where: { id },
      select: { id: true, label: true, isDefault: true },
    })
    if (!account) return fail("Storage account not found", undefined, 404)
    if (account.isDefault) {
      return fail("Make another account the default before removing this one", undefined, 409)
    }

    await db.storageAccount.delete({ where: { id } })
    invalidateStorageClient(id)

    await createAuditLog(session, {
      action: "storage_account:delete",
      module: "admin",
      entityType: "StorageAccount",
      entityId: id,
      changes: { label: account.label },
    })
    return ok(serialize({ data: { id } }))
  })
}

/** Prove the credentials work by actually listing the bucket. */
export async function testStorageAccount(
  id: string,
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const account = await db.storageAccount.findUnique({ where: { id } })
    if (!account) return fail("Storage account not found", undefined, 404)

    const appKey = tryDecrypt(account.appKey)
    if (!appKey) return fail("Stored key could not be read - re-enter it", undefined, 500)

    try {
      const { S3Client, ListObjectsV2Command } = await import("@aws-sdk/client-s3")
      const s3 = new S3Client({
        region: account.region,
        endpoint: account.endpoint,
        forcePathStyle: true,
        credentials: { accessKeyId: account.keyId, secretAccessKey: appKey },
      })
      // MaxKeys=1: proves auth and bucket access without pulling the whole list.
      const res = await s3.send(new ListObjectsV2Command({ Bucket: account.bucket, MaxKeys: 1 }))

      await db.storageAccount.update({
        where: { id },
        data: { lastVerifiedAt: new Date(), lastError: null },
      })
      await createAuditLog(session, {
        action: "storage_account:test",
        module: "admin",
        entityType: "StorageAccount",
        entityId: id,
        changes: { label: account.label, result: "ok" },
      })
      return ok(serialize({ data: { ok: true, reachable: true, sampleCount: res.KeyCount ?? 0 } }))
    } catch (err) {
      const message = err instanceof Error ? err.message.slice(0, 300) : "Connection failed"
      await db.storageAccount.update({ where: { id }, data: { lastError: message } })
      return fail(message, undefined, 400)
    }
  })
}
