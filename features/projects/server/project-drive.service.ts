import "server-only"

import { db } from "@/server/db"
import {
  ensureFolderForProject,
  listFolder,
  uploadToFolder,
  createGoogleFile,
  trashDriveFile,
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

export async function uploadProjectFile(
  projectId: string,
  name: string,
  mimeType: string,
  body: Buffer,
): Promise<DriveFile> {
  const folder = await ensureProjectFolder(projectId)
  return uploadToFolder(folder.id, name, mimeType, body)
}

export async function createProjectDoc(
  projectId: string,
  name: string,
  kind: "doc" | "sheet",
): Promise<DriveFile> {
  const folder = await ensureProjectFolder(projectId)
  return createGoogleFile(folder.id, name, kind)
}

export async function trashProjectFile(fileId: string): Promise<void> {
  await trashDriveFile(fileId)
}
