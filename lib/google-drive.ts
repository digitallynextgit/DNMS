import "server-only"

import { readFileSync } from "fs"
import { google, type drive_v3 } from "googleapis"
import { getConfig } from "@/server/app-config"
import { currentTenant } from "@/server/tenant-context"
import { FOUNDING_TENANT_ID } from "@/lib/tenant-url"

// Google Drive via a service account (Content Manager) on the company Shared Drive, so files outlive
// people. Config (DB -> env): GOOGLE_DRIVE_CREDENTIALS (inline JSON) or GOOGLE_DRIVE_KEY_FILE, plus
// GOOGLE_DRIVE_SHARED_DRIVE_ID.

export const DRIVE_FOLDER_MIME = "application/vnd.google-apps.folder"

let cached: { drive: drive_v3.Drive; sharedDriveId: string } | null = null

async function readCredentials(): Promise<{ client_email: string; private_key: string } | null> {
  const inline = await getConfig("GOOGLE_DRIVE_CREDENTIALS")
  if (inline) {
    try {
      const j = JSON.parse(inline)
      if (j.client_email && j.private_key) return j
    } catch {
      /* fall through */
    }
  }
  const path = await getConfig("GOOGLE_DRIVE_KEY_FILE")
  if (path) {
    try {
      const j = JSON.parse(readFileSync(path, "utf8"))
      if (j.client_email && j.private_key) return j
    } catch {
      /* fall through */
    }
  }
  return null
}

/**
 * Drive settings are platform-wide, so only the founding tenant (or a platform job) gets Drive.
 * Otherwise another company's Repository tab would create folders in Digitally Next's Drive.
 */
function driveAllowedHere(): boolean {
  const tenant = currentTenant()
  return !tenant || tenant.tenantId === FOUNDING_TENANT_ID
}

export async function isDriveConfigured(): Promise<boolean> {
  if (!driveAllowedHere()) return false
  const [creds, driveId] = await Promise.all([
    readCredentials(),
    getConfig("GOOGLE_DRIVE_SHARED_DRIVE_ID"),
  ])
  return !!creds && !!driveId
}

async function getDrive(): Promise<{ drive: drive_v3.Drive; sharedDriveId: string }> {
  if (!driveAllowedHere()) throw new Error("Google Drive is not available for this workspace")
  if (cached) return cached
  const creds = await readCredentials()
  const sharedDriveId = await getConfig("GOOGLE_DRIVE_SHARED_DRIVE_ID")
  if (!creds || !sharedDriveId) throw new Error("Google Drive is not configured")
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/drive"],
  })
  const drive = google.drive({ version: "v3", auth })
  cached = { drive, sharedDriveId }
  return cached
}

// Every Shared Drive call needs this flag.
const SD = { supportsAllDrives: true } as const
const SD_LIST = { supportsAllDrives: true, includeItemsFromAllDrives: true } as const

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  size: number | null
  webViewLink: string | null
  iconLink: string | null
  /** Short-lived preview image. */
  thumbnailLink: string | null
  modifiedTime: string | null
  modifiedBy: string | null
  /** Exactly one parent inside a Shared Drive. */
  parentId: string | null
  isFolder: boolean
}

function toFile(f: drive_v3.Schema$File): DriveFile {
  return {
    id: f.id!,
    name: f.name ?? "",
    mimeType: f.mimeType ?? "",
    size: f.size ? Number(f.size) : null,
    webViewLink: f.webViewLink ?? null,
    iconLink: f.iconLink ?? null,
    thumbnailLink: f.thumbnailLink ?? null,
    modifiedTime: f.modifiedTime ?? null,
    modifiedBy: f.lastModifyingUser?.displayName ?? null,
    parentId: f.parents?.[0] ?? null,
    isFolder: f.mimeType === DRIVE_FOLDER_MIME,
  }
}

const FILE_FIELDS =
  "id,name,mimeType,size,webViewLink,iconLink,thumbnailLink,modifiedTime,parents,lastModifyingUser(displayName)"

// So concurrent calls for one project share a single folder creation.
const ensureLocks = new Map<string, Promise<DriveFile>>()

/**
 * Find the folder tagged with this projectId (appProperties) or create it. files.list is eventually
 * consistent, so duplicates are also healed on read: the oldest is kept, the rest trashed.
 */
export async function ensureFolderForProject(
  projectId: string,
  folderName: string,
): Promise<DriveFile> {
  const existing = ensureLocks.get(projectId)
  if (existing) return existing

  const run = (async (): Promise<DriveFile> => {
    const { drive, sharedDriveId } = await getDrive()
    const found = await drive.files.list({
      corpora: "drive",
      driveId: sharedDriveId,
      ...SD_LIST,
      q: `appProperties has { key='dnmsProjectId' and value='${projectId}' } and mimeType='${DRIVE_FOLDER_MIME}' and trashed=false`,
      orderBy: "createdTime", // oldest first
      fields: `files(${FILE_FIELDS})`,
    })
    const files = found.data.files ?? []
    if (files.length > 0) {
      for (const dup of files.slice(1)) {
        await drive.files
          .update({ fileId: dup.id!, ...SD, requestBody: { trashed: true } })
          .catch(() => {})
      }
      return toFile(files[0])
    }

    const created = await drive.files.create({
      ...SD,
      requestBody: {
        name: folderName,
        mimeType: DRIVE_FOLDER_MIME,
        parents: [sharedDriveId],
        appProperties: { dnmsProjectId: projectId },
      },
      fields: FILE_FIELDS,
    })
    return toFile(created.data)
  })()

  ensureLocks.set(projectId, run)
  try {
    return await run
  } finally {
    ensureLocks.delete(projectId)
  }
}

/** Non-recursive; folders first, then by modified. */
export async function listFolder(folderId: string): Promise<DriveFile[]> {
  const { drive, sharedDriveId } = await getDrive()
  const res = await drive.files.list({
    corpora: "drive",
    driveId: sharedDriveId,
    ...SD_LIST,
    q: `'${folderId}' in parents and trashed=false`,
    orderBy: "folder,modifiedTime desc",
    fields: `files(${FILE_FIELDS})`,
    pageSize: 200,
  })
  return (res.data.files ?? []).map(toFile)
}

export async function uploadToFolder(
  folderId: string,
  name: string,
  mimeType: string,
  body: Buffer | NodeJS.ReadableStream,
): Promise<DriveFile> {
  const { drive } = await getDrive()
  const { Readable } = await import("stream")
  const res = await drive.files.create({
    ...SD,
    requestBody: { name, parents: [folderId] },
    media: { mimeType, body: Buffer.isBuffer(body) ? Readable.from(body) : body },
    fields: FILE_FIELDS,
  })
  return toFile(res.data)
}

export async function createGoogleFile(
  folderId: string,
  name: string,
  kind: "doc" | "sheet",
): Promise<DriveFile> {
  const { drive } = await getDrive()
  const mimeType =
    kind === "sheet"
      ? "application/vnd.google-apps.spreadsheet"
      : "application/vnd.google-apps.document"
  const res = await drive.files.create({
    ...SD,
    requestBody: { name, mimeType, parents: [folderId] },
    fields: FILE_FIELDS,
  })
  return toFile(res.data)
}

/** Export a Google-native file (e.g. a Sheet as .xlsx, keeping every tab). Drive caps exports at 10 MB. */
export async function exportDriveFile(fileId: string, mimeType: string): Promise<Buffer> {
  const { drive } = await getDrive()
  const res = await drive.files.export({ fileId, mimeType }, { responseType: "arraybuffer" })
  return Buffer.from(res.data as ArrayBuffer)
}

/** Trash only: a Content Manager can't hard-delete. */
export async function trashDriveFile(fileId: string): Promise<void> {
  const { drive } = await getDrive()
  await drive.files.update({ fileId, ...SD, requestBody: { trashed: true } })
}

export async function createDriveFolder(parentId: string, name: string): Promise<DriveFile> {
  const { drive } = await getDrive()
  const res = await drive.files.create({
    ...SD,
    requestBody: { name, mimeType: DRIVE_FOLDER_MIME, parents: [parentId] },
    fields: FILE_FIELDS,
  })
  return toFile(res.data)
}

export async function renameDriveFile(fileId: string, name: string): Promise<DriveFile> {
  const { drive } = await getDrive()
  const res = await drive.files.update({
    fileId,
    ...SD,
    requestBody: { name },
    fields: FILE_FIELDS,
  })
  return toFile(res.data)
}

/** Re-parent a file/folder. Drive needs the old parent named explicitly. */
export async function moveDriveFile(
  fileId: string,
  fromParentId: string,
  toParentId: string,
): Promise<DriveFile> {
  const { drive } = await getDrive()
  const res = await drive.files.update({
    fileId,
    ...SD,
    addParents: toParentId,
    removeParents: fromParentId,
    fields: FILE_FIELDS,
  })
  return toFile(res.data)
}

/** Null when gone, trashed or not visible. */
export async function getDriveFile(fileId: string): Promise<DriveFile | null> {
  const { drive } = await getDrive()
  try {
    const res = await drive.files.get({ fileId, ...SD, fields: `${FILE_FIELDS},trashed` })
    if (res.data.trashed) return null
    return toFile(res.data)
  } catch (e) {
    const status =
      (e as { code?: number; status?: number }).code ?? (e as { status?: number }).status
    if (status === 404) return null
    throw e
  }
}

/**
 * Ownership check behind every Drive write: the service account sees every project, so without it
 * one project's member could edit another project's files by id.
 */
export async function isUnderFolder(fileId: string, rootId: string): Promise<boolean> {
  if (fileId === rootId) return true
  let current: string | null = fileId
  for (let depth = 0; depth < 25 && current; depth++) {
    const f = await getDriveFile(current)
    if (!f) return false
    if (f.parentId === rootId) return true
    current = f.parentId
  }
  return false
}

export interface DrivePermission {
  id: string
  email: string | null
  role: string
  type: string
}

export async function listPermissions(fileId: string): Promise<DrivePermission[]> {
  const { drive } = await getDrive()
  const res = await drive.permissions.list({
    fileId,
    ...SD,
    fields: "permissions(id,emailAddress,role,type)",
  })
  return (res.data.permissions ?? []).map((p) => ({
    id: p.id!,
    email: p.emailAddress ?? null,
    role: p.role ?? "",
    type: p.type ?? "",
  }))
}

export async function grantAccess(
  fileId: string,
  email: string,
  role: "reader" | "writer" = "writer",
): Promise<void> {
  const { drive } = await getDrive()
  await drive.permissions.create({
    fileId,
    ...SD,
    sendNotificationEmail: false,
    requestBody: { role, type: "user", emailAddress: email },
  })
}

export async function revokeAccess(fileId: string, permissionId: string): Promise<void> {
  const { drive } = await getDrive()
  await drive.permissions.delete({ fileId, permissionId, ...SD })
}

/** Remove any "anyone with the link" permission someone added by hand in Drive. No-op if none. */
export async function revokeAnyoneAccess(fileId: string): Promise<void> {
  const { drive } = await getDrive()
  const perms = await listPermissions(fileId)
  for (const p of perms.filter((p) => p.type === "anyone")) {
    await drive.permissions.delete({ fileId, permissionId: p.id, ...SD }).catch(() => {})
  }
}

export interface DriveStream {
  /** 200, or 206 when the caller sent a Range header Drive honoured. */
  status: number
  body: NodeJS.ReadableStream
  contentType: string
  contentLength: string | null
  /** Present on a 206; the browser needs it verbatim to seek. */
  contentRange: string | null
}

/** `range` passes straight to Drive and its status/Content-Range come straight back, so <video> seeking works. */
export async function streamDriveFile(fileId: string, range?: string | null): Promise<DriveStream> {
  const { drive } = await getDrive()
  const res = await drive.files.get(
    { fileId, alt: "media", ...SD },
    { responseType: "stream", headers: range ? { Range: range } : {} },
  )
  return {
    status: res.status === 206 ? 206 : 200,
    body: res.data as unknown as NodeJS.ReadableStream,
    contentType: header(res.headers, "content-type") ?? "application/octet-stream",
    contentLength: header(res.headers, "content-length"),
    contentRange: header(res.headers, "content-range"),
  }
}

/**
 * googleapis returns a Headers-like object: indexing gives undefined but .get() works (older versions
 * gave a plain object), so try both. Getting this wrong silently breaks video seeking.
 */
function header(h: unknown, name: string): string | null {
  if (h && typeof (h as Headers).get === "function") {
    return (h as Headers).get(name)
  }
  return (h as Record<string, string | undefined>)?.[name] ?? null
}
