import "server-only"

import type { Prisma } from "@prisma/client"

import { db } from "@/server/db"
import {
  driveFolderUrl,
  isDriveNotFound,
  listFolder,
  searchFolders,
  type DriveFile,
} from "@/lib/google-drive"
import {
  ensureProjectFolder,
  projectDriveMemberCount,
  syncProjectFolderAccessOnOpen,
} from "./project-drive.service"
import {
  FOLDER_SELECT,
  activeMirrorField,
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
  /** Drive files with no row of ours (Docs, Sheets) in this folder's mirror. Never folders. */
  driveFiles: DriveFile[]
  drive: {
    configured: boolean
    /** Uploads go to Google Drive (true) or Backblaze. */
    onDrive: boolean
    folderLink: string | null
    memberCount: number
  }
}

export interface RepositorySearch {
  folders: (FolderRow & { itemCount: number })[]
  files: ResourceRow[]
  links: LinkRow[]
  driveFiles: DriveFile[]
  /** Where each hit lives, keyed "<source>-<id>" (folder, b2, link, drive): its folder and path. */
  locations: Record<string, { folderId: string | null; path: string }>
}

const SEARCH_LIMIT = 300

/**
 * The whole Repository searched at once - every folder, file and link by name (files and links
 * also by description, links by address), plus Drive-made Docs/Sheets by name - each with where
 * it lives, so a hit deep in the tree is found from anywhere.
 */
export async function searchRepository(
  projectId: string,
  query: string,
): Promise<RepositorySearch> {
  const text = query.trim()
  const empty: RepositorySearch = {
    folders: [],
    files: [],
    links: [],
    driveFiles: [],
    locations: {},
  }
  if (text.length < 2) return empty
  const has = { contains: text, mode: "insensitive" as const }

  const field = await activeMirrorField()
  const [tree, folders, files, links] = await Promise.all([
    db.projectFolder.findMany({
      where: { projectId },
      select: { id: true, name: true, parentId: true, driveFolderId: true, driveMirrorId: true },
    }),
    db.projectFolder.findMany({
      where: { projectId, name: has },
      select: FOLDER_SELECT,
      orderBy: { name: "asc" },
      take: SEARCH_LIMIT,
    }),
    db.projectResource.findMany({
      where: { projectId, OR: [{ fileName: has }, { description: has }] },
      include: RESOURCE_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: SEARCH_LIMIT,
    }),
    db.projectLink.findMany({
      where: { projectId, OR: [{ title: has }, { url: has }, { description: has }] },
      select: LINK_SELECT,
      orderBy: { createdAt: "desc" },
      take: SEARCH_LIMIT,
    }),
  ])

  const byId = new Map(tree.map((f) => [f.id, f]))
  const pathOf = (folderId: string | null) => {
    const names: string[] = []
    let cur = folderId ? byId.get(folderId) : undefined
    for (let depth = 0; cur && depth < 50; depth++) {
      names.unshift(cur.name)
      cur = cur.parentId ? byId.get(cur.parentId) : undefined
    }
    return names.join(" / ")
  }
  const locations: RepositorySearch["locations"] = {}
  const at = (key: string, folderId: string | null) => {
    locations[key] = { folderId, path: pathOf(folderId) }
  }
  for (const f of folders) at(`folder-${f.id}`, f.parentId)
  for (const f of files) at(`b2-${f.id}`, f.folderId)
  for (const l of links) at(`link-${l.id}`, l.folderId)

  // Drive-made Docs/Sheets have no row of ours: search their names in every mirrored folder.
  let driveFiles: DriveFile[] = []
  if (field) {
    try {
      const root = await ensureProjectFolder(projectId)
      const appFolderOf = new Map<string, string | null>([[root.id, null]])
      for (const f of tree) if (f[field]) appFolderOf.set(f[field]!, f.id)
      const tracked = new Set(
        (
          await db.projectResource.findMany({
            where: { projectId, driveFileId: { not: null } },
            select: { driveFileId: true },
          })
        ).map((r) => r.driveFileId),
      )
      driveFiles = (await searchFolders([...appFolderOf.keys()], text)).filter(
        (f) => !tracked.has(f.id),
      )
      for (const f of driveFiles) at(`drive-${f.id}`, appFolderOf.get(f.parentId ?? "") ?? null)
    } catch (error) {
      console.error("[files] Drive search failed", projectId, error)
    }
  }

  // Same counts the folder cards show elsewhere (files, links, sub-folders).
  const ids = folders.map((f) => f.id)
  const counts = new Map<string, number>()
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
    const add = (id: string | null, n: number) => {
      if (id) counts.set(id, (counts.get(id) ?? 0) + n)
    }
    for (const r of byFile) add(r.folderId, r._count._all)
    for (const r of byLink) add(r.folderId, r._count._all)
    for (const r of byChild) add(r.parentId, r._count._all)
  }

  return {
    folders: folders.map((f) => ({ ...f, itemCount: counts.get(f.id) ?? 0 })),
    files,
    links,
    driveFiles,
    locations,
  }
}

/** Items directly inside each folder: files, links and sub-folders, plus Drive-only Docs/Sheets. */
async function folderItemCounts(
  folders: FolderRow[],
  field: Awaited<ReturnType<typeof activeMirrorField>>,
): Promise<Map<string, number>> {
  const ids = folders.map((f) => f.id)
  const counts = new Map<string, number>()
  if (ids.length === 0) return counts
  const add = (id: string | null, n: number) => {
    if (id) counts.set(id, (counts.get(id) ?? 0) + n)
  }

  // Drive side: one call per mirrored sub-folder, capped so a big project can't hit the Drive quota.
  const mirrored = field ? folders.filter((f) => f[field]).slice(0, 30) : []
  // Never rejects: the Drive part of a count is cosmetic, and it runs unawaited for a while.
  const driveOnly = (async () => {
    if (!field || mirrored.length === 0) return
    try {
      const [lists, trackedRows] = await Promise.all([
        Promise.all(mirrored.map((f) => listFolder(f[field]!).catch(() => null))),
        db.projectResource.findMany({
          where: { folderId: { in: mirrored.map((f) => f.id) }, driveFileId: { not: null } },
          select: { driveFileId: true },
        }),
      ])
      const tracked = new Set(trackedRows.map((r) => r.driveFileId))
      mirrored.forEach((f, i) => {
        const items = lists[i]
        if (items) add(f.id, items.filter((x) => !x.isFolder && !tracked.has(x.id)).length)
      })
    } catch (error) {
      console.error("[files] Drive item counts failed", error)
    }
  })()

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
  await driveOnly
  return counts
}

/**
 * Everything the Files tab needs for one folder, in one round trip. The database reads, this
 * folder's Drive listing and the sub-folders' Drive counts run side by side. Drive sub-folders
 * found while listing are adopted into the tree, so a folder made in Drive shows up here too.
 */
export async function getFolderListing(
  projectId: string,
  folderId: string | null,
  actorId: string,
): Promise<FolderListing> {
  const [folder, path, field] = await Promise.all([
    folderId ? getFolder(projectId, folderId) : Promise.resolve(null),
    folderPath(projectId, folderId),
    activeMirrorField(),
  ])
  const parentId = folder?.id ?? null
  const drive = {
    configured: field !== null,
    onDrive: field === "driveMirrorId",
    folderLink: null as string | null,
    memberCount: 0,
  }

  // Drive side, started first: the project folder (cached after the first read), then this folder's listing.
  let mirrorId: string | null = null
  const listing = (async (): Promise<{ items: DriveFile[] } | { error: unknown } | null> => {
    if (!field) return null
    const root = await ensureProjectFolder(projectId)
    mirrorId = folder ? folder[field] : root.id
    drive.folderLink = folder ? (mirrorId ? driveFolderUrl(mirrorId) : null) : root.webViewLink
    if (!mirrorId) return null
    return listFolder(mirrorId).then(
      (items) => ({ items }),
      (error: unknown) => ({ error }),
    )
  })().catch((error: unknown) => ({ error }))
  const memberCount = field ? projectDriveMemberCount(projectId).catch(() => 0) : 0
  // The share re-check runs in the background now; membership changes sync on their own.
  if (field) syncProjectFolderAccessOnOpen(projectId)

  const readFolders = () =>
    db.projectFolder.findMany({
      where: { projectId, parentId },
      select: FOLDER_SELECT,
      orderBy: { name: "asc" },
    })
  const [initialFolders, files, links] = await Promise.all([
    readFolders(),
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
  // Settled into a value, so a failure while the Drive listing is awaited isn't an unhandled rejection.
  const settle = <T>(p: Promise<T>) =>
    p.then(
      (value) => ({ ok: true as const, value }),
      (error: unknown) => ({ ok: false as const, error }),
    )
  let folders = initialFolders
  let countsPromise = settle(folderItemCounts(folders, field))

  let driveItems: DriveFile[] = []
  const listed = await listing
  if (listed && "items" in listed) {
    driveItems = listed.items.filter((f) => !f.isFolder)
    // Rare: a folder made in Drive itself. Adopt it, then read the tree again so it shows now.
    if ((await adoptDriveFolders(projectId, parentId, listed.items, actorId)) > 0) {
      folders = await readFolders()
      countsPromise = settle(folderItemCounts(folders, field))
    }
  } else if (listed && "error" in listed) {
    // The mirror was deleted in Drive: forget it so the next write recreates it.
    if (folder && isDriveNotFound(listed.error)) {
      await forgetDriveMirror(folder.id)
      drive.folderLink = null
    } else {
      console.error("[files] Drive listing failed", projectId, mirrorId, listed.error)
    }
  }
  const settled = await countsPromise
  if (!settled.ok) throw settled.error
  const counts = settled.value
  drive.memberCount = await memberCount

  // Uploads are rows of ours already; only Drive-only items (Docs, Sheets) list from Drive.
  const tracked = new Set(files.map((f) => f.driveFileId).filter(Boolean))
  const driveFiles = driveItems.filter((f) => !tracked.has(f.id))

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
