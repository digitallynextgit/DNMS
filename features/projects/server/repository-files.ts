import "server-only"

import { activeDriveMode } from "@/lib/google-drive"
import { deleteVideoAsset, newShareToken, uploadVideoAsset } from "@/lib/drive-media"
import {
  deleteFile,
  getCachedSignedUrl,
  getObjectKey,
  getSignedUrl,
  uploadFile,
} from "@/lib/storage"
import { isVideoUpload } from "@/lib/upload-rules"
import { uploadProjectFile } from "./project-drive.service"

// Where a Repository file (ProjectResource) lives. With the Repository on Drive, everything goes to
// the project's Drive folder. Otherwise video goes to Drive (too big for Backblaze, and meant to be
// shared) and the rest to Backblaze.

export interface StoredObject {
  objectKey: string | null
  driveFileId: string | null
  driveWebViewLink: string | null
  isPublicLink: boolean
  shareToken: string | null
  sharedPubliclyAt: Date | null
}

interface StoredRow {
  id: string
  projectId: string
  fileName: string
  objectKey: string | null
  driveFileId: string | null
}

/** True once this company's Repository writes to the connected Google account. */
export async function repositoryOnDrive(): Promise<boolean> {
  return (await activeDriveMode()) === "account"
}

/**
 * Upload the bytes for a new row. `b2Prefix` is the Backblaze key prefix when the file goes there.
 * Video keeps a public share token either way (the portal shares it without a sign-in).
 */
export async function storeRepositoryFile(input: {
  id: string
  projectId: string
  folderId: string | null
  file: File
  b2Prefix: string
}): Promise<StoredObject> {
  const { id, projectId, folderId, file } = input
  const video = isVideoUpload({ name: file.name, type: file.type })

  if (await repositoryOnDrive()) {
    const uploaded = await uploadProjectFile(
      projectId,
      file.name.slice(0, 200),
      file.type || "application/octet-stream",
      Buffer.from(await file.arrayBuffer()),
      folderId,
      { dnmsResource: id },
    )
    return {
      objectKey: null,
      driveFileId: uploaded.id,
      driveWebViewLink: uploaded.webViewLink,
      isPublicLink: video,
      shareToken: video ? newShareToken() : null,
      sharedPubliclyAt: video ? new Date() : null,
    }
  }

  if (video) {
    const uploaded = await uploadVideoAsset(projectId, file)
    return {
      objectKey: null,
      driveFileId: uploaded.driveFileId,
      driveWebViewLink: uploaded.webViewLink,
      isPublicLink: true,
      shareToken: uploaded.shareToken,
      sharedPubliclyAt: new Date(),
    }
  }

  const objectKey = getObjectKey(input.b2Prefix, file.name, id)
  await uploadFile(
    objectKey,
    Buffer.from(await file.arrayBuffer()),
    file.type || "application/octet-stream",
    file.size,
  )
  return {
    objectKey,
    driveFileId: null,
    driveWebViewLink: null,
    isPublicLink: false,
    shareToken: null,
    sharedPubliclyAt: null,
  }
}

/** Drive files go to Drive's trash (recoverable there, and backed up for 30 days). */
export async function removeRepositoryObject(row: {
  objectKey: string | null
  driveFileId: string | null
}): Promise<void> {
  if (row.driveFileId) await deleteVideoAsset(row.driveFileId)
  else if (row.objectKey) await deleteFile(row.objectKey)
}

/**
 * A URL a signed-in staff browser can open. Drive files stream through DNMS: in Drive itself only
 * the project's team can open them.
 */
export async function repositoryFileUrl(
  row: StoredRow,
  opts: { download?: boolean; ttlSeconds?: number; cached?: boolean } = {},
): Promise<string> {
  if (row.driveFileId) {
    return `/api/projects/${row.projectId}/resources/${row.id}/file${opts.download ? "?download=1" : ""}`
  }
  const ttl = opts.ttlSeconds ?? 900
  if (opts.cached && !opts.download) return getCachedSignedUrl(row.objectKey!, ttl)
  return getSignedUrl(
    // Non-null when driveFileId is null (a CHECK constraint gives every row exactly one store).
    row.objectKey!,
    ttl,
    opts.download ? { downloadFileName: row.fileName } : undefined,
  )
}
