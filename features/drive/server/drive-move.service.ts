import "server-only"

import { createHash } from "node:crypto"

import { db } from "@/server/db"
import { ValidationError } from "@/lib/errors"
import { downloadFile } from "@/lib/storage"
import {
  activeDriveMode,
  downloadDriveFile,
  driveCompany,
  exportDriveFile,
  findAccountFileByTag,
  getAccountFile,
  listCompanyDriveFiles,
  listSharedDriveItems,
  trashDriveFile,
  type DriveFile,
} from "@/lib/google-drive"
import {
  syncProjectFolderAccess,
  uploadProjectFile,
} from "@/features/projects/server/project-drive.service"
import { NATIVE_EXPORTS } from "../lib/drive-plan"
import type { DriveMoveFailure, DriveMoveJob, DriveMoveProject, DriveMoveState } from "../types"

// Moves the Repository into the connected account's Drive: Backblaze uploads, uploads still in the
// old Shared Drive, and the old Shared Drive's own files. Every copy is checked byte-for-byte (MD5)
// before the row points at it. Re-runnable: moved files are skipped, and a half-finished upload is
// found again by its tag. Backblaze copies stay put as the first backup.

interface Job extends DriveMoveJob {
  tenantId: string
}

// On globalThis so dev hot-reload keeps the running job visible.
const g = globalThis as unknown as { driveMoveJobs?: Map<string, Job> }
const jobs: Map<string, Job> = (g.driveMoveJobs ??= new Map())

async function tenantId(): Promise<string> {
  return (await driveCompany())?.tenantId ?? ""
}

const md5 = (b: Buffer) => createHash("md5").update(b).digest("hex")

type LooseByProject = Map<string, { file: DriveFile; appFolderId: string | null }[]>

// The page polls while a move runs; listing two Drives on every poll would burn quota.
const looseCache = new Map<string, { at: number; value: LooseByProject }>()
const LOOSE_TTL_MS = 30_000

/**
 * Old Shared Drive files not yet copied, by project, with their app folder (null = top level).
 * The originals stay in the Shared Drive, so "copied" is read from the tag on the copy.
 */
async function sharedDriveFilesByProject(fresh = false): Promise<LooseByProject> {
  const key = await tenantId()
  const hit = looseCache.get(key)
  if (!fresh && hit && Date.now() - hit.at < LOOSE_TTL_MS) return hit.value
  const value = await loadLooseFiles()
  looseCache.set(key, { at: Date.now(), value })
  return value
}

async function loadLooseFiles(): Promise<LooseByProject> {
  const out: LooseByProject = new Map()
  const [shared, inAccount] = await Promise.all([
    listSharedDriveItems().catch(() => null),
    listCompanyDriveFiles().catch(() => [] as DriveFile[]),
  ])
  if (!shared) return out
  const copied = new Set(inAccount.map((f) => f.appProperties?.dnmsLegacyId).filter(Boolean))

  const place = new Map<string, { projectId: string; appFolderId: string | null }>()
  for (const f of shared.folders) {
    const projectId = f.appProperties?.dnmsProjectId
    if (projectId) place.set(f.id, { projectId, appFolderId: null })
  }
  const mirrors = await db.projectFolder.findMany({
    where: { driveFolderId: { in: shared.folders.map((f) => f.id) } },
    select: { id: true, projectId: true, driveFolderId: true },
  })
  for (const m of mirrors)
    place.set(m.driveFolderId!, { projectId: m.projectId, appFolderId: m.id })

  // Uploads that are rows of ours move with their row, not as loose files.
  const rowFiles = new Set(
    (
      await db.projectResource.findMany({
        where: { driveFileId: { in: shared.files.map((f) => f.id) } },
        select: { driveFileId: true },
      })
    ).map((r) => r.driveFileId),
  )

  // A deleted project's leftovers stay behind: moving them would recreate its folder.
  const live = new Set(
    (
      await db.project.findMany({
        where: { id: { in: [...new Set([...place.values()].map((p) => p.projectId))] } },
        select: { id: true },
      })
    ).map((p) => p.id),
  )

  for (const f of shared.files) {
    if (rowFiles.has(f.id) || copied.has(f.id) || !f.parentId) continue
    const at = place.get(f.parentId)
    if (!at || !live.has(at.projectId)) continue
    const list = out.get(at.projectId) ?? []
    list.push({ file: f, appFolderId: at.appFolderId })
    out.set(at.projectId, list)
  }
  return out
}

export async function getMoveState(): Promise<DriveMoveState> {
  const [mode, onB2, onDrive, sharedByProject] = await Promise.all([
    activeDriveMode(),
    db.projectResource.groupBy({
      by: ["projectId"],
      where: { objectKey: { not: null } },
      _count: { _all: true },
      _sum: { fileSize: true },
    }),
    db.projectResource.groupBy({
      by: ["projectId"],
      where: { driveFileId: { not: null } },
      _count: { _all: true },
    }),
    sharedDriveFilesByProject(),
  ])

  const ids = new Set([
    ...onB2.map((r) => r.projectId),
    ...onDrive.map((r) => r.projectId),
    ...sharedByProject.keys(),
  ])
  const projects = await db.project.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  })
  const b2 = new Map(onB2.map((r) => [r.projectId, r]))
  const drive = new Map(onDrive.map((r) => [r.projectId, r._count._all]))

  const rows: DriveMoveProject[] = projects.map((p) => ({
    id: p.id,
    name: p.name,
    code: p.code,
    b2Files: b2.get(p.id)?._count._all ?? 0,
    b2Bytes: b2.get(p.id)?._sum.fileSize ?? 0,
    driveFiles: drive.get(p.id) ?? 0,
    sharedFiles: sharedByProject.get(p.id)?.length ?? 0,
  }))

  const job = jobs.get(await tenantId()) ?? null
  return { canMove: mode === "account", projects: rows, job: job ? publicJob(job) : null }
}

function publicJob(job: Job): DriveMoveJob {
  const { tenantId: _t, ...rest } = job
  return { ...rest, failed: [...rest.failed] }
}

/** Start moving one project (or all). Returns at once; the page polls getMoveState(). */
export async function startMove(projectId: string | null): Promise<DriveMoveJob> {
  if ((await activeDriveMode()) !== "account") {
    throw new ValidationError("Switch the Repository to Google Drive first, then move the files.")
  }
  const key = await tenantId()
  const running = jobs.get(key)
  if (running?.running) return publicJob(running)

  const job: Job = {
    tenantId: key,
    running: true,
    scope: projectId ?? "all",
    current: null,
    done: 0,
    total: 0,
    moved: 0,
    failed: [],
    startedAt: new Date().toISOString(),
    finishedAt: null,
  }
  jobs.set(key, job)
  // Detached on purpose; it keeps this request's tenant context.
  void runMove(job, projectId).catch((e) => {
    job.failed.push({ project: "-", name: "-", error: e instanceof Error ? e.message : String(e) })
    job.running = false
    job.finishedAt = new Date().toISOString()
  })
  return publicJob(job)
}

async function runMove(job: Job, onlyProject: string | null): Promise<void> {
  const projectFilter = onlyProject ? { projectId: onlyProject } : {}
  const [b2Rows, driveRows, sharedByProject, backedUp] = await Promise.all([
    db.projectResource.findMany({
      where: { ...projectFilter, objectKey: { not: null } },
      select: {
        id: true,
        projectId: true,
        folderId: true,
        fileName: true,
        mimeType: true,
        fileSize: true,
        objectKey: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    db.projectResource.findMany({
      where: { ...projectFilter, driveFileId: { not: null } },
      select: {
        id: true,
        projectId: true,
        folderId: true,
        fileName: true,
        mimeType: true,
        driveFileId: true,
      },
    }),
    sharedDriveFilesByProject(true),
    db.driveBackup.findMany({ select: { driveFileId: true } }),
  ])
  // A Drive row with a backup is in the account already; the rest are checked one by one.
  const known = new Set(backedUp.map((b) => b.driveFileId))
  const maybeOld = driveRows.filter((r) => !known.has(r.driveFileId!))
  const loose = onlyProject
    ? (sharedByProject.get(onlyProject) ?? [])
    : [...sharedByProject.values()].flat()

  const projectIds = new Set([
    ...b2Rows.map((r) => r.projectId),
    ...maybeOld.map((r) => r.projectId),
    ...(onlyProject ? (loose.length ? [onlyProject] : []) : [...sharedByProject.keys()]),
  ])
  const names = new Map(
    (
      await db.project.findMany({
        where: { id: { in: [...projectIds] } },
        select: { id: true, name: true },
      })
    ).map((p) => [p.id, p.name]),
  )
  const projectOfLoose = new Map<string, string>()
  for (const [pid, list] of sharedByProject)
    for (const l of list) projectOfLoose.set(l.file.id, pid)

  job.total = b2Rows.length + maybeOld.length + loose.length

  const step = async (projectId: string, name: string, fn: () => Promise<boolean>) => {
    job.current = `${names.get(projectId) ?? "Project"} · ${name}`
    try {
      if (await fn()) job.moved++
    } catch (e) {
      const failure: DriveMoveFailure = {
        project: names.get(projectId) ?? projectId,
        name,
        error: e instanceof Error ? e.message : String(e),
      }
      job.failed.push(failure)
      console.error("[drive-move]", failure)
    }
    job.done++
  }

  for (const row of b2Rows) await step(row.projectId, row.fileName, () => moveBackblazeRow(row))
  for (const row of maybeOld) await step(row.projectId, row.fileName, () => moveSharedDriveRow(row))
  for (const l of loose) {
    const pid = onlyProject ?? projectOfLoose.get(l.file.id)!
    await step(pid, l.file.name, () => moveLooseFile(pid, l.file, l.appFolderId))
  }

  // Shares follow the new folders, so the team can open them in Drive straight away.
  job.current = "Sharing folders with each team"
  for (const pid of projectIds) {
    await syncProjectFolderAccess(pid).catch((e) =>
      console.error("[drive-move] access sync failed", pid, e),
    )
  }

  looseCache.delete(job.tenantId)
  job.current = null
  job.running = false
  job.finishedAt = new Date().toISOString()
}

/** Upload, or reuse the copy a previous interrupted run already made. Throws on a checksum mismatch. */
async function uploadChecked(input: {
  projectId: string
  folderId: string | null
  name: string
  mimeType: string
  bytes: Buffer
  tag: [string, string]
}): Promise<DriveFile> {
  const sum = md5(input.bytes)
  const earlier = await findAccountFileByTag(input.tag[0], input.tag[1])
  if (earlier?.md5 === sum) return earlier
  if (earlier) await trashDriveFile(earlier.id).catch(() => {})

  const uploaded = await uploadProjectFile(
    input.projectId,
    input.name,
    input.mimeType,
    input.bytes,
    input.folderId,
    { [input.tag[0]]: input.tag[1] },
  )
  if (uploaded.md5 !== sum || (uploaded.size ?? -1) !== input.bytes.length) {
    await trashDriveFile(uploaded.id).catch(() => {})
    throw new Error(
      "The copy in Drive did not match the original, so it was removed. Run the move again.",
    )
  }
  return uploaded
}

async function moveBackblazeRow(row: {
  id: string
  projectId: string
  folderId: string | null
  fileName: string
  mimeType: string
  objectKey: string | null
}): Promise<boolean> {
  const key = row.objectKey!
  const bytes = await downloadFile(key)
  const uploaded = await uploadChecked({
    projectId: row.projectId,
    folderId: row.folderId,
    name: row.fileName,
    mimeType: row.mimeType,
    bytes,
    tag: ["dnmsResource", row.id],
  })

  // The Backblaze object becomes the file's first backup, so the nightly run won't copy it again.
  const backup = {
    projectId: row.projectId,
    resourceId: row.id,
    name: row.fileName,
    mimeType: row.mimeType,
    size: BigInt(bytes.length),
    b2Key: key,
    sourceModifiedAt: uploaded.modifiedTime ? new Date(uploaded.modifiedTime) : new Date(),
    backedUpAt: new Date(),
    deletedAt: null,
  }
  await db.driveBackup.upsert({
    where: { driveFileId: uploaded.id },
    create: { driveFileId: uploaded.id, ...backup },
    update: backup,
  })
  // Guarded on the old key, so a row changed meanwhile is left alone.
  const { count } = await db.projectResource.updateMany({
    where: { id: row.id, objectKey: key },
    data: { objectKey: null, driveFileId: uploaded.id, driveWebViewLink: uploaded.webViewLink },
  })
  return count === 1
}

async function moveSharedDriveRow(row: {
  id: string
  projectId: string
  folderId: string | null
  fileName: string
  mimeType: string
  driveFileId: string | null
}): Promise<boolean> {
  const oldId = row.driveFileId!
  // Already in the account (an upload made after the switch): nothing to move.
  if (await getAccountFile(oldId)) return false
  const bytes = await downloadDriveFile(oldId)
  const uploaded = await uploadChecked({
    projectId: row.projectId,
    folderId: row.folderId,
    name: row.fileName,
    mimeType: row.mimeType,
    bytes,
    tag: ["dnmsResource", row.id],
  })
  const { count } = await db.projectResource.updateMany({
    where: { id: row.id, driveFileId: oldId },
    data: { driveFileId: uploaded.id, driveWebViewLink: uploaded.webViewLink },
  })
  return count === 1
}

/** A file that only ever lived in the old Shared Drive (no row of ours): copied as-is. */
async function moveLooseFile(
  projectId: string,
  file: DriveFile,
  appFolderId: string | null,
): Promise<boolean> {
  if (await findAccountFileByTag("dnmsLegacyId", file.id)) return false
  const native = NATIVE_EXPORTS[file.mimeType]
  if (file.mimeType.startsWith("application/vnd.google-apps.") && !native) {
    throw new Error("This Google file type can't be copied; move it by hand in Drive")
  }
  const bytes = native
    ? await exportDriveFile(file.id, native.mimeType)
    : await downloadDriveFile(file.id)
  await uploadChecked({
    projectId,
    folderId: appFolderId,
    name: native && !file.name.endsWith(native.ext) ? `${file.name}${native.ext}` : file.name,
    mimeType: native?.mimeType ?? file.mimeType,
    bytes,
    tag: ["dnmsLegacyId", file.id],
  })
  return true
}
