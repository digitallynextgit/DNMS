import "server-only"

import type { Session } from "next-auth"

import { db } from "@/server/db"
import { getConfig, reloadConfig } from "@/server/app-config"
import { ValidationError } from "@/lib/errors"
import { createAuditLog } from "@/lib/audit"
import {
  connectedDriveAccount,
  driveOAuthCredentials,
  isRevokedGrant,
} from "@/lib/google-drive-oauth"
import {
  REPOSITORY_STORAGE_KEY,
  accountRootFolder,
  driveAccountAbout,
  isSharedDriveConfigured,
} from "@/lib/google-drive"
import { nextBackupAt } from "../lib/drive-plan"
import type { DriveBackupRunInfo, DriveStatus } from "../types"

const ymd = (d: Date) => d.toISOString().slice(0, 10)

export function toRunInfo(r: {
  runDate: Date
  status: string
  checked: number
  copied: number
  bytesCopied: bigint
  failed: number
  error: string | null
  startedAt: Date
  finishedAt: Date | null
}): DriveBackupRunInfo {
  return {
    runDate: ymd(r.runDate),
    status: r.status as DriveBackupRunInfo["status"],
    checked: r.checked,
    copied: r.copied,
    bytesCopied: Number(r.bytesCopied),
    failed: r.failed,
    error: r.error,
    startedAt: r.startedAt.toISOString(),
    finishedAt: r.finishedAt?.toISOString() ?? null,
  }
}

export async function repositoryStorageSetting(): Promise<"b2" | "drive"> {
  return (await getConfig(REPOSITORY_STORAGE_KEY)) === "drive" ? "drive" : "b2"
}

/** Everything the Storage page's Google Drive card shows, in one call. */
export async function getDriveStatus(): Promise<DriveStatus> {
  const [credentials, account, storage, sharedDrive] = await Promise.all([
    driveOAuthCredentials(),
    connectedDriveAccount(),
    repositoryStorageSetting(),
    isSharedDriveConfigured(),
  ])

  let quota: DriveStatus["quota"] = null
  let error: string | null = null
  let rootLink: string | null = null
  if (account) {
    try {
      const about = await driveAccountAbout()
      if (about) {
        quota = {
          limit: about.limit,
          usage: about.usage,
          usageInDrive: about.usageInDrive,
          usageInDriveTrash: about.usageInDriveTrash,
        }
      }
      rootLink = (await accountRootFolder())?.link ?? null
    } catch (e) {
      error = isRevokedGrant(e)
        ? "Google refused DNMS's access (removed from the account, or the password changed). Reconnect the account."
        : `Could not read Drive: ${e instanceof Error ? e.message : String(e)}`
    }
  }

  const [onDrive, onB2, lastRun, backedUp] = await Promise.all([
    db.projectResource.aggregate({
      where: { driveFileId: { not: null } },
      _count: { _all: true },
      _sum: { fileSize: true },
    }),
    db.projectResource.aggregate({
      where: { objectKey: { not: null } },
      _count: { _all: true },
      _sum: { fileSize: true },
    }),
    db.driveBackupRun.findFirst({ orderBy: { runDate: "desc" } }),
    db.driveBackup.aggregate({
      where: { deletedAt: null },
      _count: { _all: true },
      _sum: { size: true },
    }),
  ])

  const last = lastRun ? toRunInfo(lastRun) : null
  return {
    credentials: !!credentials,
    account,
    error,
    quota,
    storage,
    repository: {
      driveFiles: onDrive._count._all,
      driveBytes: onDrive._sum.fileSize ?? 0,
      b2Files: onB2._count._all,
      b2Bytes: onB2._sum.fileSize ?? 0,
    },
    rootLink,
    sharedDrive,
    backup: {
      last,
      nextAt: account ? nextBackupAt(new Date(), last?.runDate ?? null).toISOString() : null,
      files: backedUp._count._all,
      bytes: Number(backedUp._sum.size ?? 0),
    },
  }
}

/**
 * Where new Repository uploads go. Files already stored stay where they are and keep opening
 * either way, so switching back is safe.
 */
export async function setRepositoryStorage(
  session: Session,
  storage: "b2" | "drive",
): Promise<"b2" | "drive"> {
  if (storage === "drive" && !(await connectedDriveAccount())) {
    throw new ValidationError(
      "Connect a Google account first (Admin -> Integrations -> Google Drive)",
    )
  }
  const before = await repositoryStorageSetting()
  await db.appSetting.upsert({
    where: { key: REPOSITORY_STORAGE_KEY },
    create: { key: REPOSITORY_STORAGE_KEY, value: storage, isSecret: false },
    update: { value: storage, isSecret: false },
  })
  await reloadConfig()
  await createAuditLog(session, {
    action: "SETTINGS_UPDATE",
    module: "admin",
    entityType: "AppSetting",
    entityId: REPOSITORY_STORAGE_KEY,
    changes: { repositoryStorage: { from: before, to: storage } },
  })
  return storage
}
