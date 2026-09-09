import "server-only"

import type { Prisma } from "@prisma/client"
import type { Session } from "next-auth"

import { db } from "@/server/db"
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors"
import {
  createDriveFolder,
  isDriveConfigured,
  listFolder,
  moveDriveFile,
  renameDriveFile,
  trashDriveFile,
  type DriveFile,
} from "@/lib/google-drive"
import { canManageProject } from "./project-access"
import { ensureProjectFolder } from "./project-drive.service"

export const FOLDER_SELECT = {
  id: true,
  projectId: true,
  parentId: true,
  name: true,
  driveFolderId: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, firstName: true, lastName: true, profilePhoto: true } },
} satisfies Prisma.ProjectFolderSelect

export type FolderRow = Prisma.ProjectFolderGetPayload<{ select: typeof FOLDER_SELECT }>

export async function listProjectFolders(projectId: string): Promise<FolderRow[]> {
  return db.projectFolder.findMany({
    where: { projectId },
    select: FOLDER_SELECT,
    orderBy: { name: "asc" },
  })
}

export async function getFolder(projectId: string, folderId: string): Promise<FolderRow> {
  const folder = await db.projectFolder.findFirst({
    where: { id: folderId, projectId },
    select: FOLDER_SELECT,
  })
  if (!folder) throw new NotFoundError("Folder")
  return folder
}

/** Root → folder, for the breadcrumb. Empty array for the top level. */
export async function folderPath(
  projectId: string,
  folderId: string | null,
): Promise<{ id: string; name: string }[]> {
  if (!folderId) return []
  const all = await db.projectFolder.findMany({
    where: { projectId },
    select: { id: true, name: true, parentId: true },
  })
  const byId = new Map(all.map((f) => [f.id, f]))
  const path: { id: string; name: string }[] = []
  let cur = byId.get(folderId)
  if (!cur) throw new NotFoundError("Folder")
  // Depth guard: a cycle is impossible through the service, but a hand-edited
  // row must not hang the request.
  for (let depth = 0; cur && depth < 50; depth++) {
    path.unshift({ id: cur.id, name: cur.name })
    cur = cur.parentId ? byId.get(cur.parentId) : undefined
  }
  return path
}

// Two folders with the same name side by side are indistinguishable in the
// breadcrumb and in "Move to...", so siblings are unique case-insensitively.
async function assertUniqueSibling(
  projectId: string,
  parentId: string | null,
  name: string,
  exceptId?: string,
) {
  const clash = await db.projectFolder.findFirst({
    where: {
      projectId,
      parentId,
      name: { equals: name, mode: "insensitive" },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { id: true },
  })
  if (clash) throw new ValidationError(`A folder called "${name}" already exists here`)
}

/** Whoever made the folder, or anyone who can manage the project. Same rule as files. */
async function assertCanEdit(session: Session, projectId: string, folder: { createdById: string }) {
  if (folder.createdById === session.user.id) return
  if (await canManageProject(session, projectId)) return
  throw new ForbiddenError("Only the folder's creator or a project manager can change it")
}

/**
 * The Drive sub-folder mirroring an app folder, created on first need (uploads
 * to Drive, new Docs, moves). Creates the parent chain first so the Drive tree
 * matches the app tree. Returns null when Drive is off or the mirror could not
 * be made - callers then fall back to the project root rather than failing the
 * user's action over a Drive hiccup.
 */
export async function ensureDriveMirror(
  projectId: string,
  folderId: string,
): Promise<string | null> {
  if (!(await isDriveConfigured())) return null
  const folder = await db.projectFolder.findFirst({
    where: { id: folderId, projectId },
    select: { id: true, parentId: true, name: true, driveFolderId: true },
  })
  if (!folder) throw new NotFoundError("Folder")
  if (folder.driveFolderId) return folder.driveFolderId
  try {
    let parentDriveId: string
    if (folder.parentId) {
      const parentMirror = await ensureDriveMirror(projectId, folder.parentId)
      // Never create a child at the root when its parent has no mirror - that
      // would put it in the wrong place in Drive, which is worse than no mirror.
      if (!parentMirror) return null
      parentDriveId = parentMirror
    } else {
      parentDriveId = (await ensureProjectFolder(projectId)).id
    }
    const created = await createDriveFolder(parentDriveId, folder.name)
    await db.projectFolder.update({
      where: { id: folder.id },
      data: { driveFolderId: created.id },
    })
    return created.id
  } catch (error) {
    console.error("[folders] Drive mirror failed for", folderId, error)
    return null
  }
}

export async function createFolder(
  session: Session,
  projectId: string,
  input: { name: string; parentId: string | null },
): Promise<FolderRow> {
  const name = input.name.trim()
  if (input.parentId) await getFolder(projectId, input.parentId)
  await assertUniqueSibling(projectId, input.parentId, name)
  const folder = await db.projectFolder.create({
    data: { projectId, parentId: input.parentId, name, createdById: session.user.id },
    select: FOLDER_SELECT,
  })
  const driveFolderId = await ensureDriveMirror(projectId, folder.id)
  return { ...folder, driveFolderId }
}

export async function renameFolder(
  session: Session,
  projectId: string,
  folderId: string,
  name: string,
): Promise<FolderRow> {
  const folder = await getFolder(projectId, folderId)
  await assertCanEdit(session, projectId, folder)
  const trimmed = name.trim()
  if (trimmed === folder.name) return folder
  await assertUniqueSibling(projectId, folder.parentId, trimmed, folder.id)
  const updated = await db.projectFolder.update({
    where: { id: folder.id },
    data: { name: trimmed },
    select: FOLDER_SELECT,
  })
  if (folder.driveFolderId) {
    await renameDriveFile(folder.driveFolderId, trimmed).catch((e) =>
      console.error("[folders] Drive rename failed", folderId, e),
    )
  }
  return updated
}

export async function moveFolder(
  session: Session,
  projectId: string,
  folderId: string,
  parentId: string | null,
): Promise<FolderRow> {
  const folder = await getFolder(projectId, folderId)
  await assertCanEdit(session, projectId, folder)
  if (parentId === folder.parentId) return folder
  if (parentId === folder.id) throw new ValidationError("A folder cannot be moved into itself")
  if (parentId) {
    // Walk up from the target: if we meet the folder being moved, the move
    // would create a cycle (moving a folder into one of its own sub-folders).
    let cursor: string | null = parentId
    for (let depth = 0; cursor && depth < 50; depth++) {
      if (cursor === folder.id) {
        throw new ValidationError("A folder cannot be moved into one of its own sub-folders")
      }
      const p: { parentId: string | null } | null = await db.projectFolder.findFirst({
        where: { id: cursor, projectId },
        select: { parentId: true },
      })
      if (!p) throw new NotFoundError("Folder")
      cursor = p.parentId
    }
  }
  await assertUniqueSibling(projectId, parentId, folder.name, folder.id)
  const updated = await db.projectFolder.update({
    where: { id: folder.id },
    data: { parentId },
    select: FOLDER_SELECT,
  })
  if (folder.driveFolderId) {
    try {
      const root = await ensureProjectFolder(projectId)
      const from = folder.parentId
        ? ((
            await db.projectFolder.findUnique({
              where: { id: folder.parentId },
              select: { driveFolderId: true },
            })
          )?.driveFolderId ?? root.id)
        : root.id
      const to = parentId ? ((await ensureDriveMirror(projectId, parentId)) ?? root.id) : root.id
      if (from !== to) await moveDriveFile(folder.driveFolderId, from, to)
    } catch (error) {
      console.error("[folders] Drive move failed", folderId, error)
    }
  }
  return updated
}

/**
 * Delete a folder. Refuses unless it is EMPTY on both sides (no sub-folders,
 * files or links here, nothing in the mirrored Drive folder). Moving contents
 * up silently would scatter files; deleting them would destroy work. Making
 * the person empty it first is the only version of this that cannot surprise.
 */
export async function deleteFolder(session: Session, projectId: string, folderId: string) {
  const folder = await getFolder(projectId, folderId)
  await assertCanEdit(session, projectId, folder)
  const [children, files, links] = await Promise.all([
    db.projectFolder.count({ where: { parentId: folder.id } }),
    db.projectResource.count({ where: { folderId: folder.id } }),
    db.projectLink.count({ where: { folderId: folder.id } }),
  ])
  const inside = children + files + links
  if (inside > 0) {
    throw new ValidationError(
      `"${folder.name}" still has ${inside} ${inside === 1 ? "item" : "items"} in it. Move or delete them first.`,
    )
  }
  if (folder.driveFolderId) {
    let driveItems: DriveFile[] = []
    try {
      driveItems = await listFolder(folder.driveFolderId)
    } catch {
      // Mirror already gone in Drive - nothing to protect.
    }
    if (driveItems.length > 0) {
      throw new ValidationError(
        `"${folder.name}" still has ${driveItems.length} ${driveItems.length === 1 ? "item" : "items"} in Google Drive. Move or delete them first.`,
      )
    }
    await trashDriveFile(folder.driveFolderId).catch(() => {})
  }
  await db.projectFolder.delete({ where: { id: folder.id } })
  return folder
}

/**
 * Give every Drive sub-folder listed under an app folder a row of its own, so
 * folders people make in Drive directly join the one tree. Idempotent: keyed on
 * the Drive id. The reader becomes the "creator" - it is the only person in the
 * request, and creator-ship only widens who may rename/delete.
 */
export async function adoptDriveFolders(
  projectId: string,
  parentId: string | null,
  driveChildren: DriveFile[],
  actorId: string,
): Promise<void> {
  const folders = driveChildren.filter((f) => f.isFolder)
  if (folders.length === 0) return
  const known = new Set(
    (
      await db.projectFolder.findMany({
        where: { driveFolderId: { in: folders.map((f) => f.id) } },
        select: { driveFolderId: true },
      })
    ).map((f) => f.driveFolderId),
  )
  for (const f of folders) {
    if (known.has(f.id)) continue
    await db.projectFolder
      .create({
        data: {
          projectId,
          parentId,
          name: f.name || "Untitled folder",
          driveFolderId: f.id,
          createdById: actorId,
        },
      })
      .catch(() => {
        // Lost a race with a parallel read that adopted it first - fine.
      })
  }
}

/** A mirror that was deleted in Drive is forgotten so it can be recreated on the next write. */
export async function forgetDriveMirror(folderId: string): Promise<void> {
  await db.projectFolder.update({ where: { id: folderId }, data: { driveFolderId: null } })
}
