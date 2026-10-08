import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3"
import { getSignedUrl as presignUrl } from "@aws-sdk/s3-request-presigner"
import { getConfig } from "@/server/app-config"

// Backblaze B2 via the S3 SDK. Config comes from storage_accounts (uploads go to the default row);
// every function takes an optional accountId last. app_settings B2_EMPLOYEE_DOCS_* is the fallback.

interface ResolvedAccount {
  s3: S3Client
  bucket: string
  accountId: string | null
}

// One client per account - an S3Client holds a connection pool.
const clientCache = new Map<string, ResolvedAccount>()

/** Call after an account's credentials change. */
export function invalidateStorageClient(accountId?: string): void {
  if (accountId) clientCache.delete(accountId)
  else clientCache.clear()
}

function buildClient(
  cfg: { endpoint: string; region: string; bucket: string; keyId: string; appKey: string },
  accountId: string | null,
): ResolvedAccount {
  return {
    s3: new S3Client({
      region: cfg.region,
      endpoint: cfg.endpoint,
      forcePathStyle: true, // B2 S3 API uses path-style addressing
      credentials: { accessKeyId: cfg.keyId, secretAccessKey: cfg.appKey },
    }),
    bucket: cfg.bucket,
    accountId,
  }
}

async function getClient(accountId?: string): Promise<ResolvedAccount> {
  const cacheKey = accountId ?? "__default__"
  const hit = clientCache.get(cacheKey)
  if (hit) return hit

  const { db } = await import("@/server/db")
  const { tryDecrypt } = await import("@/lib/crypto")

  const account = accountId
    ? await db.storageAccount.findUnique({ where: { id: accountId } })
    : await db.storageAccount.findFirst({ where: { isDefault: true, isActive: true } })

  if (account) {
    const appKey = tryDecrypt(account.appKey)
    if (!appKey) {
      throw new Error(`Storage account "${account.label}" has an unreadable key - re-enter it`)
    }
    const resolved = buildClient(
      {
        endpoint: account.endpoint,
        region: account.region,
        bucket: account.bucket,
        keyId: account.keyId,
        appKey,
      },
      account.id,
    )
    clientCache.set(cacheKey, resolved)
    return resolved
  }

  // Legacy fallback: no accounts configured yet.
  const resolved = buildClient(
    {
      endpoint: (await getConfig("B2_EMPLOYEE_DOCS_ENDPOINT")) || "",
      region: (await getConfig("B2_EMPLOYEE_DOCS_REGION")) || "us-east-005",
      bucket: (await getConfig("B2_EMPLOYEE_DOCS_BUCKET")) || "hrms-documents",
      keyId: (await getConfig("B2_EMPLOYEE_DOCS_KEY_ID")) || "",
      appKey: (await getConfig("B2_EMPLOYEE_DOCS_APP_KEY")) || "",
    },
    null,
  )
  clientCache.set(cacheKey, resolved)
  return resolved
}

// Buckets are created in the B2 console; kept for existing callers.
export async function ensureBucket(): Promise<void> {}

export async function isB2Configured(): Promise<boolean> {
  // A DB hiccup here should fall through to the legacy settings, not blank the storage screen.
  try {
    const { db } = await import("@/server/db")
    if (await db.storageAccount.count({ where: { isActive: true } })) return true
  } catch (e) {
    console.error("[storage] account lookup failed, falling back to settings:", e)
  }

  const [endpoint, bucket, keyId, appKey] = await Promise.all([
    getConfig("B2_EMPLOYEE_DOCS_ENDPOINT"),
    getConfig("B2_EMPLOYEE_DOCS_BUCKET"),
    getConfig("B2_EMPLOYEE_DOCS_KEY_ID"),
    getConfig("B2_EMPLOYEE_DOCS_APP_KEY"),
  ])
  return Boolean(endpoint && bucket && keyId && appKey)
}

export async function uploadFile(
  objectKey: string,
  buffer: Buffer,
  contentType: string,
  _size?: number,
  accountId?: string,
): Promise<void> {
  const { s3, bucket } = await getClient(accountId)
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: buffer,
      ContentType: contentType,
    }),
  )
  // After the write: clearing first could let a read re-cache the old listing.
  invalidateObjectList(accountId)
}

/** Server-side only (e.g. text extraction for the AI assistant). */
export async function downloadFile(objectKey: string, accountId?: string): Promise<Buffer> {
  const { s3, bucket } = await getClient(accountId)
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey }))
  const body = res.Body as unknown as { transformToByteArray?: () => Promise<Uint8Array> }
  if (body?.transformToByteArray) {
    return Buffer.from(await body.transformToByteArray())
  }
  const chunks: Buffer[] = []
  for await (const chunk of res.Body as unknown as AsyncIterable<Buffer>) chunks.push(chunk)
  return Buffer.concat(chunks)
}

/** encodeURIComponent plus `( ) ' *`, which B2 rejects unescaped in content-disposition. */
function rfc5987(str: string): string {
  return encodeURIComponent(str).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  )
}

/** ASCII `filename` fallback plus the exact name in `filename*` (latin-1 headers mangle the rest). */
function contentDisposition(name: string): string {
  const clean = name.replace(/["\r\n]/g, "").trim() || "download"
  // Parens, spaces and commas are fine inside the quoted fallback.
  const ascii = clean.replace(/[^\x20-\x7E]/g, "_").replace(/[\\"]/g, "_")
  return `attachment; filename="${ascii}"; filename*=UTF-8''${rfc5987(clean)}`
}

export async function getSignedUrl(
  objectKey: string,
  expirySeconds = 900,
  opts?: { downloadFileName?: string },
): Promise<string> {
  const { s3, bucket } = await getClient()
  // `attachment` forces a download; without it images/PDFs open inline.
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    ResponseContentDisposition: opts?.downloadFileName
      ? contentDisposition(opts.downloadFileName)
      : undefined,
  })
  // SigV4 presigned URLs can't be valid for more than 7 days.
  const SEVEN_DAYS = 7 * 24 * 60 * 60
  return presignUrl(s3, command, { expiresIn: Math.min(expirySeconds, SEVEN_DAYS) })
}

// Memoised plain (no-disposition) signed URLs, so repeat image views skip re-signing. Not for
// downloads. Callers 302 with a long browser cache, so a cached URL is only reused while it
// outlives that window (minRemainingSeconds) - otherwise viewers hit a dead URL for days.
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>()

export async function getCachedSignedUrl(
  objectKey: string,
  expirySeconds = 900,
  minRemainingSeconds = 60,
): Promise<string> {
  const hit = signedUrlCache.get(objectKey)
  if (hit && hit.expiresAt > Date.now() + minRemainingSeconds * 1000) return hit.url
  const url = await getSignedUrl(objectKey, expirySeconds)
  signedUrlCache.set(objectKey, { url, expiresAt: Date.now() + expirySeconds * 1000 })
  // Signed URLs are cheap to regenerate, so just evict the oldest.
  if (signedUrlCache.size > 5_000) {
    const now = Date.now()
    for (const [k, v] of signedUrlCache) if (v.expiresAt <= now) signedUrlCache.delete(k)
  }
  return url
}

export async function deleteFile(objectKey: string, accountId?: string): Promise<void> {
  const { s3, bucket } = await getClient(accountId)
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }))
  invalidateObjectList(accountId)
}

export interface StorageObject {
  key: string
  size: number
  lastModified: string | null
}

// Listing a bucket takes 0.5-3.5s, so hold it briefly. Writes clear it (invalidateObjectList).
const OBJECT_LIST_TTL_MS = 60_000
const objectListCache = new Map<string, { at: number; objects: StorageObject[] }>()

export function invalidateObjectList(accountId?: string): void {
  if (accountId) objectListCache.delete(accountId)
  else objectListCache.clear()
}

/** Paginated: B2 returns up to 1000 per page. */
export async function listAllObjects(accountId?: string): Promise<StorageObject[]> {
  const cacheKey = accountId ?? "__default__"
  const hit = objectListCache.get(cacheKey)
  if (hit && Date.now() - hit.at < OBJECT_LIST_TTL_MS) return hit.objects

  const { s3, bucket } = await getClient(accountId)
  const out: StorageObject[] = []
  let token: string | undefined
  do {
    const res = await s3.send(
      new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }),
    )
    for (const o of res.Contents ?? []) {
      if (o.Key) {
        out.push({
          key: o.Key,
          size: o.Size ?? 0,
          lastModified: o.LastModified ? o.LastModified.toISOString() : null,
        })
      }
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (token)
  objectListCache.set(cacheKey, { at: Date.now(), objects: out })
  return out
}

export function getObjectKey(prefix: string, originalFileName: string, id: string): string {
  const ext = originalFileName.split(".").pop()?.toLowerCase() || "bin"
  const sanitized = originalFileName
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-z0-9]/gi, "-")
    .toLowerCase()
    .substring(0, 40)
  return `${prefix}/${id}-${sanitized}.${ext}`
}
