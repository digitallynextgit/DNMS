import "server-only"

import { db } from "@/server/db"
import { isDemoEmail } from "@/lib/demo"
import { PERMISSIONS } from "@/lib/constants"
import { ensureProjectDriveFolder } from "@/lib/drive-media"
import { connectedDriveAccount } from "@/lib/google-drive-oauth"
import {
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

const PERSON = { select: { email: true, isActive: true, status: true } } as const
// Leavers lose access the moment they are marked as gone, not when someone tidies the team.
const GONE = ["RESIGNED", "TERMINATED", "SUSPENDED"] as const
const GONE_SET = new Set<string>(GONE)

/**
 * Anyone whose role shows them every project in DNMS (listProjects widens on exactly these two).
 * Drive has to match that, or an admin sees a file list it cannot open.
 */
async function everyProjectViewers(): Promise<Array<{ email: string; isActive: boolean; status: string }>> {
  return db.employee.findMany({
    where: {
      isActive: true,
      status: { notIn: [...GONE] },
      employeeRoles: {
        some: {
          role: {
            rolePermissions: {
              some: {
                permission: {
                  scope: { in: [PERMISSIONS.PROJECT_WRITE, PERMISSIONS.PROJECT_VIEW_ALL] },
                },
              },
            },
          },
        },
      },
    },
    select: { email: true, isActive: true, status: true },
  })
}

/** Both Account Managers, every team member who still works here, and the all-project roles. */
async function projectMemberEmails(projectId: string): Promise<string[]> {
  const [project, viewers] = await Promise.all([
    db.project.findUnique({
      where: { id: projectId },
      select: {
        owner: PERSON,
        secondaryAccountManager: PERSON,
        teams: { select: { members: { select: { employee: PERSON } } } },
      },
    }),
    everyProjectViewers(),
  ])
  if (!project) return []
  const people = [
    project.owner,
    project.secondaryAccountManager,
    ...project.teams.flatMap((t) => t.members.map((m) => m.employee)),
    ...viewers,
  ]
  const emails = new Set<string>()
  for (const p of people) {
    if (!p?.email || !p.isActive || GONE_SET.has(p.status)) continue
    // Demo-company addresses aren't real Google accounts; Drive would reject the share.
    if (isDemoEmail(p.email)) continue
    emails.add(p.email.toLowerCase())
  }
  return [...emails]
}

// Lives in lib/drive-media.ts so the client portal can share it; re-exported under the old name.
export const ensureProjectFolder = ensureProjectDriveFolder

/** Make the folder's shares match the project's members exactly (grant + revoke). Idempotent. */
export async function syncProjectFolderAccess(
  projectId: string,
): Promise<{ folderId: string; granted: number; revoked: number; members: number }> {
  const folder = await ensureProjectFolder(projectId)
  const wanted = new Set(await projectMemberEmails(projectId))
  const current = await listPermissions(folder.id)
  // The connected account owns everything already; sharing with itself is an error.
  const self = (await connectedDriveAccount())?.email.toLowerCase()
  if (self) wanted.delete(self)

  let granted = 0
  let revoked = 0

  // Only revoke per-user shares this app added - never the service account, domain/anyone or owner.
  for (const p of current) {
    if (p.type !== "user" || !p.email) continue
    if (p.role === "owner") continue
    const email = p.email.toLowerCase()
    if (email.endsWith(".gserviceaccount.com")) continue // the robot itself
    if (email === self) continue
    if (!wanted.has(email)) {
      try {
        await revokeAccess(folder.id, p.id)
        revoked++
      } catch (e) {
        console.error("[drive] revoke failed", projectId, email, e)
      }
    }
  }

  const have = new Set(
    current.filter((p) => p.type === "user" && p.email).map((p) => p.email!.toLowerCase()),
  )
  for (const email of wanted) {
    if (!have.has(email)) {
      // Logged, not thrown: one bad address must not stop the rest of the team getting access.
      try {
        await grantAccess(folder.id, email, "writer")
        granted++
      } catch (e) {
        console.error("[drive] share failed", projectId, email, e)
      }
    }
  }

  return { folderId: folder.id, granted, revoked, members: wanted.size }
}

/** Who the project folder should be shared with, counted from the database (no Drive call). */
export async function projectDriveMemberCount(projectId: string): Promise<number> {
  const [emails, account] = await Promise.all([
    projectMemberEmails(projectId),
    connectedDriveAccount(),
  ])
  const self = account?.email.toLowerCase()
  return emails.filter((e) => e !== self).length
}

// Last background re-check per project. Membership changes sync on their own; this only catches drift.
const lastOpenSync = new Map<string, number>()
const OPEN_SYNC_EVERY_MS = 10 * 60_000

/** Re-check the folder's shares when the Repository is opened - in the background, at most every 10 minutes. */
export function syncProjectFolderAccessOnOpen(projectId: string): void {
  const last = lastOpenSync.get(projectId) ?? 0
  if (Date.now() - last < OPEN_SYNC_EVERY_MS) return
  lastOpenSync.set(projectId, Date.now())
  syncProjectFolderAccessAsync(projectId)
}

/** Fire-and-forget so a slow Drive call never blocks the response. No-op without Drive. */
export function syncProjectFolderAccessAsync(projectId: string): void {
  void isDriveConfigured()
    .then((ok) => {
      if (ok) return syncProjectFolderAccess(projectId)
    })
    .catch((e) => console.error("[drive] access sync failed for project", projectId, e))
}

/** Projects whose Drive folder shares someone. Read it BEFORE an exit removes them from teams. */
export async function driveProjectIdsFor(employeeIds: string[]): Promise<string[]> {
  if (employeeIds.length === 0) return []
  const projects = await db.project.findMany({
    where: {
      OR: [
        { ownerId: { in: employeeIds } },
        { secondaryAccountManagerId: { in: employeeIds } },
        { teams: { some: { members: { some: { employeeId: { in: employeeIds } } } } } },
      ],
    },
    select: { id: true },
  })
  return projects.map((p) => p.id)
}

/** After someone leaves or changes email. Fire-and-forget, like syncProjectFolderAccessAsync. */
export function syncProjectsFolderAccessAsync(projectIds: string[]): void {
  if (projectIds.length === 0) return
  void (async () => {
    if (!(await isDriveConfigured())) return
    for (const id of projectIds) {
      await syncProjectFolderAccess(id).catch((e) =>
        console.error("[drive] access sync failed for project", id, e),
      )
    }
  })()
}

export interface ProjectDriveData {
  configured: boolean
  folderId: string | null
  folderLink: string | null
  memberCount: number
  files: DriveFile[]
}

/** Folder link, files and access count for the Drive tab. Ensures the folder and access on read. */
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
 * Drive target for a write: the app folder's mirror (created on demand) or the project root.
 * Throws when the app folder is not this project's.
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
  tags: Record<string, string> = {},
): Promise<DriveFile> {
  const target = await driveTargetFor(projectId, appFolderId)
  return uploadToFolder(target, name, mimeType, body, { dnmsProject: projectId, ...tags })
}

export async function createProjectDoc(
  projectId: string,
  name: string,
  kind: "doc" | "sheet",
  appFolderId: string | null = null,
): Promise<DriveFile> {
  const target = await driveTargetFor(projectId, appFolderId)
  return createGoogleFile(target, name, kind, { dnmsProject: projectId })
}

/**
 * Is this file under THIS project's folder? The service account sees every project, so every
 * write checks this - otherwise any fileId could touch another project's files.
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

/** A Google Sheet as .xlsx for the importer; null unless it's under this project's folder. */
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
