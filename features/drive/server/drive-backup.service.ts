import "server-only"

import { db } from "@/server/db"
import { ValidationError } from "@/lib/errors"
import { deleteFile, uploadFile } from "@/lib/storage"
import { isDriveAccountConnected } from "@/lib/google-drive-oauth"
import {
  activeDriveMode,
  downloadDriveFile,
  driveCompany,
  exportDriveFile,
  listCompanyDriveFiles,
} from "@/lib/google-drive"
import { syncProjectFolderAccess } from "@/features/projects/server/project-drive.service"
import {
  BACKUP_PREFIX,
  DELETED_RETENTION_DAYS,
  NATIVE_EXPORTS,
  backupDue,
  backupKey,
  istParts,
  needsBackup,
} from "../lib/drive-plan"

// Nightly copy of the Repository's Drive files to Backblaze: new and changed files only, one object
// per file. Google Docs/Sheets are saved as Office files. Backups of files deleted in Drive are kept
// DELETED_RETENTION_DAYS, then removed. The run also re-checks every project's Drive sharing.

export interface BackupOutcome {
  skipped?: string
  checked: number
  copied: number
  bytesCopied: number
  failed: number
}

const ymd = (d: Date) => d.toISOString().slice(0, 10)
const EMPTY: BackupOutcome = { checked: 0, copied: 0, bytesCopied: 0, failed: 0 }

// A RUNNING row older than this is a run that died with its server, not one still going.
const STALE_RUN_MS = 3 * 3_600_000

/** The hourly tick: runs once per IST day at or after 2 AM. Null when not due or not set up. */
export async function runScheduledDriveBackup(now = new Date()): Promise<BackupOutcome | null> {
  if (!(await driveCompany()) || !(await isDriveAccountConnected())) return null
  const last = await db.driveBackupRun.findFirst({
    orderBy: { runDate: "desc" },
    select: { runDate: true },
  })
  if (!backupDue(now, last ? ymd(last.runDate) : null)) return null
  return runDriveBackup({ manual: false, now })
}

/** One backup run, claimed in the DB per IST day. "Back up now" re-runs today's. */
export async function runDriveBackup(opts: {
  manual: boolean
  now?: Date
}): Promise<BackupOutcome> {
  const company = await driveCompany()
  if (!company) throw new ValidationError("Google Drive is not available for this workspace")
  if (!(await isDriveAccountConnected())) {
    throw new ValidationError("Connect a Google account first")
  }
  const now = opts.now ?? new Date()
  const runDate = new Date(`${istParts(now).date}T00:00:00.000Z`)

  let runId: string
  // Looked up first, so "Back up now" on a day that already ran doesn't trip the unique key.
  const existing = await db.driveBackupRun.findFirst({ where: { runDate } })
  if (!existing) {
    try {
      runId = (await db.driveBackupRun.create({ data: { runDate }, select: { id: true } })).id
    } catch (e) {
      // Another server (or the dev machine) claimed today's run a moment ago.
      if ((e as { code?: string }).code === "P2002")
        return { ...EMPTY, skipped: "Already ran today" }
      throw e
    }
  } else {
    if (!opts.manual) return { ...EMPTY, skipped: "Already ran today" }
    if (
      existing.status === "RUNNING" &&
      now.getTime() - existing.startedAt.getTime() < STALE_RUN_MS
    ) {
      throw new ValidationError("A backup is already running")
    }
    await db.driveBackupRun.update({
      where: { id: existing.id },
      data: {
        status: "RUNNING",
        checked: 0,
        copied: 0,
        bytesCopied: 0,
        failed: 0,
        error: null,
        startedAt: now,
        finishedAt: null,
      },
    })
    runId = existing.id
  }

  try {
    const outcome = await copyChangedFiles(now, company.slug)
    await db.driveBackupRun.update({
      where: { id: runId },
      data: {
        status: "DONE",
        checked: outcome.checked,
        copied: outcome.copied,
        bytesCopied: BigInt(outcome.bytesCopied),
        failed: outcome.failed,
        error: outcome.failed ? `${outcome.failed} file(s) could not be copied` : null,
        finishedAt: new Date(),
      },
    })
    return outcome
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await db.driveBackupRun
      .update({
        where: { id: runId },
        data: { status: "FAILED", error: message.slice(0, 500), finishedAt: new Date() },
      })
      .catch(() => {})
    throw e
  }
}

async function copyChangedFiles(now: Date, slug: string): Promise<BackupOutcome> {
  const [files, existing, rows] = await Promise.all([
    listCompanyDriveFiles(),
    db.driveBackup.findMany(),
    db.projectResource.findMany({
      where: { driveFileId: { not: null } },
      select: { id: true, projectId: true, driveFileId: true },
    }),
  ])
  const prevById = new Map(existing.map((b) => [b.driveFileId, b]))
  const rowById = new Map(rows.map((r) => [r.driveFileId!, r]))
  const out: BackupOutcome = { ...EMPTY }

  // Sequential on purpose: each file is held in memory while it is copied.
  for (const f of files) {
    out.checked++
    const prev = prevById.get(f.id) ?? null
    if (!needsBackup(f.modifiedTime, prev)) {
      // Back from Drive's trash: its backup is current again.
      if (prev?.deletedAt) {
        await db.driveBackup.update({ where: { id: prev.id }, data: { deletedAt: null } })
      }
      continue
    }
    const native = NATIVE_EXPORTS[f.mimeType]
    // Forms, shortcuts and the like have no file to save.
    if (f.mimeType.startsWith("application/vnd.google-apps.") && !native) continue

    try {
      const data = native
        ? await exportDriveFile(f.id, native.mimeType)
        : await downloadDriveFile(f.id)
      const row = rowById.get(f.id)
      const projectId = row?.projectId ?? f.appProperties?.dnmsProject ?? null
      const key = backupKey({
        tenantSlug: slug,
        projectId,
        driveFileId: f.id,
        name: f.name,
        ext: native?.ext,
      })
      await uploadFile(
        key,
        data,
        native?.mimeType ?? (f.mimeType || "application/octet-stream"),
        data.length,
      )
      const fields = {
        projectId,
        resourceId: row?.id ?? null,
        name: f.name,
        mimeType: f.mimeType,
        size: BigInt(data.length),
        b2Key: key,
        sourceModifiedAt: f.modifiedTime ? new Date(f.modifiedTime) : now,
        backedUpAt: new Date(),
        deletedAt: null,
      }
      await db.driveBackup.upsert({
        where: { driveFileId: f.id },
        create: { driveFileId: f.id, ...fields },
        update: fields,
      })
      // Only our own backup objects are replaced; a moved file's original Backblaze object is left
      // for an admin to clear up.
      if (prev && prev.b2Key !== key && prev.b2Key.startsWith(BACKUP_PREFIX)) {
        await deleteFile(prev.b2Key).catch(() => {})
      }
      out.copied++
      out.bytesCopied += data.length
    } catch (e) {
      out.failed++
      console.error("[drive-backup] copy failed", f.id, f.name, e)
    }
  }

  // An empty listing while backups exist is far likelier a Drive hiccup than everything deleted.
  if (files.length > 0 || existing.length === 0) {
    const present = new Set(files.map((f) => f.id))
    const gone = existing.filter((b) => !b.deletedAt && !present.has(b.driveFileId))
    if (gone.length > 0) {
      await db.driveBackup.updateMany({
        where: { id: { in: gone.map((b) => b.id) } },
        data: { deletedAt: now },
      })
    }
  }

  const cutoff = new Date(now.getTime() - DELETED_RETENTION_DAYS * 86_400_000)
  const expired = await db.driveBackup.findMany({ where: { deletedAt: { lt: cutoff } } })
  for (const b of expired) {
    try {
      await deleteFile(b.b2Key)
      await db.driveBackup.delete({ where: { id: b.id } })
    } catch (e) {
      console.error("[drive-backup] purge failed", b.b2Key, e)
    }
  }

  // Nightly safety net for sharing: catches leavers, renamed emails and deleted teams.
  if ((await activeDriveMode()) === "account") {
    const tagged = new Set([
      ...rows.map((r) => r.projectId),
      ...files.map((f) => f.appProperties?.dnmsProject).filter((p): p is string => !!p),
    ])
    // Live projects only: syncing a deleted one would recreate its folder.
    const live = await db.project.findMany({
      where: { id: { in: [...tagged] } },
      select: { id: true },
    })
    for (const { id } of live) {
      await syncProjectFolderAccess(id).catch((e) =>
        console.error("[drive-backup] access sync failed", id, e),
      )
    }
  }

  return out
}
