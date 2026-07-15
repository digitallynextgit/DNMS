import "server-only"

import { readFileSync } from "fs"
import { google, type drive_v3 } from "googleapis"
import { getConfig } from "@/server/app-config"

// =============================================================================
// Google Drive client (service account -> a company Shared Drive).
//
// Files live in a Shared Drive owned by the org, so they survive people leaving
// and don't count against any one person's quota. The service account is a member
// (Content Manager) of that Shared Drive. Credentials resolve from config (DB) ->
// env, so nothing is hard-coded:
//   GOOGLE_DRIVE_CREDENTIALS      - the service-account JSON, inline (use in prod)
//   GOOGLE_DRIVE_KEY_FILE         - OR a path to that JSON (handy in dev)
//   GOOGLE_DRIVE_SHARED_DRIVE_ID  - the Shared Drive id
// =============================================================================

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

export async function isDriveConfigured(): Promise<boolean> {
  const [creds, driveId] = await Promise.all([
    readCredentials(),
    getConfig("GOOGLE_DRIVE_SHARED_DRIVE_ID"),
  ])
  return !!creds && !!driveId
}

async function getDrive(): Promise<{ drive: drive_v3.Drive; sharedDriveId: string }> {
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

// Shared-drive calls all need these flags, so wrap them once.
const SD = { supportsAllDrives: true } as const
const SD_LIST = { supportsAllDrives: true, includeItemsFromAllDrives: true } as const

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  size: number | null
  webViewLink: string | null
  iconLink: string | null
  modifiedTime: string | null
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
    modifiedTime: f.modifiedTime ?? null,
    isFolder: f.mimeType === DRIVE_FOLDER_MIME,
  }
}

const FILE_FIELDS = "id,name,mimeType,size,webViewLink,iconLink,modifiedTime"

// In-process guard: two requests for the same project (e.g. two members opening the
// Files tab at once) must not each create a folder. They share one in-flight promise.
const ensureLocks = new Map<string, Promise<DriveFile>>()

/**
 * Find the folder tagged with this projectId (via appProperties), or create it.
 * Using appProperties means the project<->folder link lives in Drive itself, so no
 * new DB column is needed.
 *
 * Two guards against duplicates, because Drive's `files.list` is EVENTUALLY
 * CONSISTENT (a just-created folder isn't instantly findable by search):
 *   1. an in-process lock so concurrent calls share one creation, and
 *   2. self-healing on read - if more than one folder is found for a project, the
 *      OLDEST is kept and the rest are trashed, so any past duplicate converges.
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
      // Self-heal: trash any duplicate folders (keep the oldest).
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

/** Files inside a folder (non-recursive), folders first then by modified. */
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

/** Create a blank Google Doc or Sheet in the folder. */
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

/** Trash a file/folder (Content Manager can trash; hard-delete needs Manager). */
export async function trashDriveFile(fileId: string): Promise<void> {
  const { drive } = await getDrive()
  await drive.files.update({ fileId, ...SD, requestBody: { trashed: true } })
}

// ── Per-file permission sync (item-level sharing inside the Shared Drive) ──────

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
