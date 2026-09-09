import "server-only"

import type { Prisma } from "@prisma/client"

import { db } from "@/server/db"
import { isDriveConfigured, listFolder, type DriveFile } from "@/lib/google-drive"
import { ensureProjectFolder, syncProjectFolderAccess } from "./project-drive.service"
import {
  FOLDER_SELECT,
  adoptDriveFolders,
  folderPath,
  forgetDriveMirror,
  getFolder,
  type FolderRow,
} from "./folders.service"
import { LINK_SELECT, type LinkRow } from "./links.service"

const RESOURCE_INCLUDE = {
  uploadedBy: { select: { id: true, firstName: true, lastName: true, profilePhoto: true } },
  team: { select: { id: true, name: true } },
} satisfies Prisma.ProjectResourceInclude

export type ResourceRow = Prisma.ProjectResourceGetPayload<{ include: typeof RESOURCE_INCLUDE }>

export interface FolderListing {
  /** The folder being viewed; null at the project's top level. */
  folder: { id: string; name: string; parentId: string | null } | null
  /** Root → current, for the breadcrumb. */
  path: { id: string; name: string }[]
  folders: (FolderRow & { itemCount: number })[]
  files: ResourceRow[]
  links: LinkRow[]
  /** Drive files (never folders - those are adopted into `folders`) in this folder's mirror. */
  driveFiles: DriveFile[]
  drive: {
    configured: boolean
    /** Open-in-Drive target for the folder being viewed. */
    folderLink: string | null
    memberCount: number
  }
}

function isNotFound(error: unknown): boolean {
  const e = error as { code?: number | string; status?: number; response?: { status?: number } }
  return e?.code === 404 || e?.status === 404 || e?.response?.status === 404
}

/**
 * Everything the Files tab needs for ONE folder, in one round trip: the
 * sub-folders (with how much is in each), the Backblaze files, the links and
 * the mirrored Drive folder's files. Drive sub-folders found while listing are
 * adopted into the tree on the way through, so a folder someone made in Drive
 * shows up here like any other.
 */
export async function getFolderListing(
  projectId: string,
  folderId: string | null,
  actorId: string,
): Promise<FolderListing> {
  const folder = folderId ? await getFolder(projectId, folderId) : null
  const path = await folderPath(projectId, folderId)

  let driveFiles: DriveFile[] = []
  const drive = { configured: false, folderLink: null as string | null, memberCount: 0 }

  if (await isDriveConfigured()) {
    drive.configured = true
    const root = await ensureProjectFolder(projectId)
    const mirrorId = folder ? folder.driveFolderId : root.id
    drive.folderLink = folder
      ? mirrorId
        ? `https://drive.google.com/drive/folders/${mirrorId}`
        : null
      : root.webViewLink
    if (mirrorId) {
      try {
        // Access sync is per project, so it only rides along with the root read.
        const [items, sync] = await Promise.all([
          listFolder(mirrorId),
          folder ? Promise.resolve(null) : syncProjectFolderAccess(projectId).catch(() => null),
        ])
        await adoptDriveFolders(projectId, folder?.id ?? null, items, actorId)
        driveFiles = items.filter((f) => !f.isFolder)
        drive.memberCount = sync?.members ?? 0
      } catch (error) {
        // The mirror was deleted in Drive: forget it so the next write recreates it.
        if (folder && isNotFound(error)) {
          await forgetDriveMirror(folder.id)
          drive.folderLink = null
        } else {
          console.error("[files] Drive listing failed", projectId, mirrorId, error)
        }
      }
    }
  }

  const parentId = folder?.id ?? null
  const [folders, files, links] = await Promise.all([
    db.projectFolder.findMany({
      where: { projectId, parentId },
      select: FOLDER_SELECT,
      orderBy: { name: "asc" },
    }),
    db.projectResource.findMany({
      where: { projectId, folderId: parentId },
      include: RESOURCE_INCLUDE,
      orderBy: { createdAt: "desc" },
    }),
    db.projectLink.findMany({
      where: { projectId, folderId: parentId },
      select: LINK_SELECT,
      orderBy: { createdAt: "desc" },
    }),
  ])

  // "12 items" on a folder row: its files + links + sub-folders + Drive files.
  const ids = folders.map((f) => f.id)
  const counts = new Map<string, number>()
  const add = (id: string | null, n: number) => {
    if (id) counts.set(id, (counts.get(id) ?? 0) + n)
  }
  if (ids.length > 0) {
    const [byFile, byLink, byChild] = await Promise.all([
      db.projectResource.groupBy({
        by: ["folderId"],
        where: { folderId: { in: ids } },
        _count: { _all: true },
      }),
      db.projectLink.groupBy({
        by: ["folderId"],
        where: { folderId: { in: ids } },
        _count: { _all: true },
      }),
      db.projectFolder.groupBy({
        by: ["parentId"],
        where: { parentId: { in: ids } },
        _count: { _all: true },
      }),
    ])
    for (const r of byFile) add(r.folderId, r._count._all)
    for (const r of byLink) add(r.folderId, r._count._all)
    for (const r of byChild) add(r.parentId, r._count._all)
    if (drive.configured) {
      // One Drive call per mirrored sub-folder, in parallel. Capped so a
      // project with hundreds of folders cannot fan out into a Drive quota hit;
      // the rest simply show their app-side count.
      const mirrored = folders.filter((f) => f.driveFolderId).slice(0, 30)
      await Promise.all(
        mirrored.map((f) =>
          listFolder(f.driveFolderId!)
            .then((items) => add(f.id, items.filter((i) => !i.isFolder).length))
            .catch(() => {}),
        ),
      )
    }
  }

  return {
    folder: folder ? { id: folder.id, name: folder.name, parentId: folder.parentId } : null,
    path,
    folders: folders.map((f) => ({ ...f, itemCount: counts.get(f.id) ?? 0 })),
    files,
    links,
    driveFiles,
    drive,
  }
}
