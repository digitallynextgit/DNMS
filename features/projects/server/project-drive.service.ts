import "server-only"

import { db } from "@/server/db"
import {
  ensureFolderForProject,
  listFolder,
  uploadToFolder,
  createGoogleFile,
  trashDriveFile,
  renameDriveFile,
  moveDriveFile,
  getDriveFile,
  isUnderFolder,
  exportDriveFile,
  listPermissions,
  grantAccess,
  revokeAccess,
  isDriveConfigured,
  type DriveFile,
} from "@/lib/google-drive"

/** The people who should have access to a project's Drive folder: the owner +
 *  every team member, by their (work) email. */
async function projectMemberEmails(projectId: string): Promise<string[]> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      owner: { select: { email: true } },
      teams: { select: { members: { select: { employee: { select: { email: true } } } } } },
    },
  })
  if (!project) return []
  const emails = new Set<string>()
  if (project.owner?.email) emails.add(project.owner.email.toLowerCase())
  for (const t of project.teams)
    for (const m of t.members) if (m.employee?.email) emails.add(m.employee.email.toLowerCase())
  return [...emails]
}

/** Ensure the project's folder exists (named "<code> · <name>") and return it. */
export async function ensureProjectFolder(projectId: string): Promise<DriveFile> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { code: true, name: true },
  })
  const folderName = project ? `${project.code} · ${project.name}` : projectId
  return ensureFolderForProject(projectId, folderName)
}

/**
 * Make the folder's shared-with list match the project's members exactly:
 * grant anyone missing, revoke anyone no longer on the project. Idempotent, so
 * it's safe to call on every membership change and from a manual "Sync" button.
 * Returns a small summary for the UI/logs.
 */
export async function syncProjectFolderAccess(
  projectId: string,
): Promise<{ folderId: string; granted: number; revoked: number; members: number }> {
  const folder = await ensureProjectFolder(projectId)
  const wanted = new Set(await projectMemberEmails(projectId))
  const current = await listPermissions(folder.id)

  let granted = 0
  let revoked = 0

  // Revoke item-level user permissions for people no longer on the project. NEVER
  // touch the service account, domain/anyone permissions, or the inherited
  // Shared-Drive owner - only the per-user shares this app added.
  for (const p of current) {
    if (p.type !== "user" || !p.email) continue
    if (p.role === "owner") continue
    const email = p.email.toLowerCase()
    if (email.endsWith(".gserviceaccount.com")) continue // the robot itself
    if (!wanted.has(email)) {
      await revokeAccess(folder.id, p.id).catch(() => {})
      revoked++
    }
  }

  // Grant anyone on the project who isn't already shared.
  const have = new Set(
    current.filter((p) => p.type === "user" && p.email).map((p) => p.email!.toLowerCase()),
  )
  for (const email of wanted) {
    if (!have.has(email)) {
      await grantAccess(folder.id, email, "writer").catch(() => {})
      granted++
    }
  }

  return { folderId: folder.id, granted, revoked, members: wanted.size }
}

/** Fire-and-forget sync (used from member add/remove routes so a slow Drive call
 *  never blocks the HTTP response). No-ops silently when Drive isn't configured. */
export function syncProjectFolderAccessAsync(projectId: string): void {
  void isDriveConfigured()
    .then((ok) => {
      if (ok) return syncProjectFolderAccess(projectId)
    })
    .catch((e) => console.error("[drive] access sync failed for project", projectId, e))
}

export interface ProjectDriveData {
  configured: boolean
  folderId: string | null
  folderLink: string | null
  memberCount: number
  files: DriveFile[]
}

/** Everything the project's Drive tab needs: the folder link, its files, and how
 *  many people currently have access. Ensures the folder + access on read. */
export async function getProjectDrive(projectId: string): Promise<ProjectDriveData> {
  if (!(await isDriveConfigured())) {
    return { configured: false, folderId: null, folderLink: null, memberCount: 0, files: [] }
  }
  const folder = await ensureProjectFolder(projectId)
  const [files, sync] = await Promise.all([
    listFolder(folder.id),
    syncProjectFolderAccess(projectId).catch(() => ({ members: 0 })),
  ])
  return {
    configured: true,
    folderId: folder.id,
    folderLink: folder.webViewLink,
    memberCount: sync.members,
    files,
  }
}

/**
 * The Drive folder a write should land in: the app folder's mirrored Drive
 * sub-folder (created on demand), or the project root when no app folder is
 * given. Throws when the app folder is not this project's.
 */
async function driveTargetFor(projectId: string, appFolderId: string | null): Promise<string> {
  const root = await ensureProjectFolder(projectId)
  if (!appFolderId) return root.id
  const { ensureDriveMirror } = await import("./folders.service")
  const mirror = await ensureDriveMirror(projectId, appFolderId)
  return mirror ?? root.id
}

export async function uploadProjectFile(
  projectId: string,
  name: string,
  mimeType: string,
  body: Buffer,
  appFolderId: string | null = null,
): Promise<DriveFile> {
  const target = await driveTargetFor(projectId, appFolderId)
  return uploadToFolder(target, name, mimeType, body)
}

export async function createProjectDoc(
  projectId: string,
  name: string,
  kind: "doc" | "sheet",
  appFolderId: string | null = null,
): Promise<DriveFile> {
  const target = await driveTargetFor(projectId, appFolderId)
  return createGoogleFile(target, name, kind)
}

/**
 * Does this Drive file live under THIS project's folder (any depth)? The
 * service account can see every project's folder, so every write below checks
 * this first - without it a member of one project could pass any fileId and
 * rename/move/trash another project's files (SEC-07).
 */
async function ownsDriveFile(projectId: string, fileId: string): Promise<boolean> {
  const root = await ensureProjectFolder(projectId)
  if (fileId === root.id) return false // the project root itself is never a target
  return isUnderFolder(fileId, root.id)
}

/** Trash a file (recoverable). Returns false when it is not this project's (caller 404s). */
export async function trashProjectFile(projectId: string, fileId: string): Promise<boolean> {
  if (!(await ownsDriveFile(projectId, fileId))) return false
  await trashDriveFile(fileId)
  return true
}

export async function renameProjectDriveFile(
  projectId: string,
  fileId: string,
  name: string,
): Promise<DriveFile | null> {
  if (!(await ownsDriveFile(projectId, fileId))) return null
  return renameDriveFile(fileId, name)
}

/** Move a Drive file into an app folder's mirror (null = project root). */
export async function moveProjectDriveFile(
  projectId: string,
  fileId: string,
  appFolderId: string | null,
): Promise<DriveFile | null> {
  if (!(await ownsDriveFile(projectId, fileId))) return null
  const current = await getDriveFile(fileId)
  if (!current?.parentId) return null
  const target = await driveTargetFor(projectId, appFolderId)
  if (target === current.parentId) return current
  return moveDriveFile(fileId, current.parentId, target)
}

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

/**
 * A Google Sheet from this project's Drive tree as an .xlsx (every tab), for
 * the sheet importer. Null when the file is not under the project's folder -
 * the service account can read every project's Drive, so without that check a
 * file id from another project would export another client's data.
 */
export async function exportProjectDriveSheet(
  projectId: string,
  fileId: string,
): Promise<{ name: string; data: Buffer } | null> {
  if (!(await ownsDriveFile(projectId, fileId))) return null
  const file = await getDriveFile(fileId)
  if (!file) return null
  if (!file.mimeType.includes("spreadsheet")) {
    throw new Error("That Drive file is not a Google Sheet")
  }
  return { name: file.name, data: await exportDriveFile(fileId, XLSX_MIME) }
}
