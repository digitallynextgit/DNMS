import "server-only"

import { db } from "@/server/db"
import { randomBytes } from "node:crypto"
import {
  ensureFolderForProject,
  uploadToFolder,
  trashDriveFile,
  revokeAnyoneAccess,
  isDriveConfigured,
  type DriveFile,
} from "@/lib/google-drive"
import { MAX_VIDEO_SIZE } from "@/lib/constants"
import { siteConfig } from "@/lib/site"

// Images and documents go to Backblaze behind signed URLs. Video is too big for that and is meant
// for outsiders, so it goes to the project's Drive folder. Shared by the portal and staff routes.

/** Ensure the project's folder exists (named "<code> · <name>") and return it. */
export async function ensureProjectDriveFolder(projectId: string): Promise<DriveFile> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { code: true, name: true },
  })
  const folderName = project ? `${project.code} · ${project.name}` : projectId
  return ensureFolderForProject(projectId, folderName)
}

export interface VideoUploadResult {
  driveFileId: string
  fileName: string
  fileSize: number
  mimeType: string
  /** Internal only: outsiders hit a permission wall. */
  webViewLink: string | null
  /** The secret behind the public share route. Store it; never log it. */
  shareToken: string
}

/** 192 random bits, base64url. The token is the only credential for the public route. */
export function newShareToken(): string {
  return randomBytes(24).toString("base64url")
}

export function shareUrlFor(token: string): string {
  return `${siteConfig.url.replace(/\/$/, "")}/api/public/share/${token}`
}

/** Thrown for the cases a caller should turn into a 4xx rather than a 500. */
export class VideoUploadError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = "VideoUploadError"
  }
}

/**
 * The Drive file stays private; /api/public/share/<token> streams it. The Workspace refuses public
 * files, and a token is revocable.
 */
export async function uploadVideoAsset(projectId: string, file: File): Promise<VideoUploadResult> {
  if (!(await isDriveConfigured())) {
    throw new VideoUploadError(
      "Video needs Google Drive, which is not configured. Add the Drive service account and Shared Drive id under Admin -> Integrations.",
      503,
    )
  }
  if (file.size === 0) throw new VideoUploadError("That file is empty", 400)
  if (file.size > MAX_VIDEO_SIZE) {
    throw new VideoUploadError(
      `Videos must be under ${Math.floor(MAX_VIDEO_SIZE / 1024 / 1024)} MB`,
      413,
    )
  }

  const folder = await ensureProjectDriveFolder(projectId)
  const fileName = file.name.slice(0, 200)
  const mimeType = file.type || "video/mp4"
  const uploaded = await uploadToFolder(
    folder.id,
    fileName,
    mimeType,
    Buffer.from(await file.arrayBuffer()),
  )

  return {
    driveFileId: uploaded.id,
    fileName,
    fileSize: file.size,
    mimeType,
    webViewLink: uploaded.webViewLink,
    shareToken: newShareToken(),
  }
}

/** Revoke first: trashing alone doesn't stop Drive serving the URL to people who saved it. */
export async function deleteVideoAsset(driveFileId: string): Promise<void> {
  await revokeAnyoneAccess(driveFileId).catch(() => {})
  await trashDriveFile(driveFileId)
}
