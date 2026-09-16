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
import { siteConfig } from "@/config/site"

// =============================================================================
// Where a content-plan asset is stored, and who can see it.
//
// Images and documents keep going to Backblaze behind short-lived signed urls -
// that is unchanged and is the right default, because those assets are client
// work product that only portal users should reach.
//
// VIDEO is different on both counts. It is too big for the 20 MB portal cap, and
// the point of a finished video is usually to send it to someone who has no
// login here - which a signed url that expires in an hour cannot do. So video
// goes to the project's Drive folder and is published as "anyone with the link".
//
// This lives in lib/ rather than inside a feature because BOTH the client portal
// and the staff resources route upload against the same deliverables and must
// apply the same rule. Keeping one copy is the whole point: a second, subtly
// different rule on one side is how an asset ends up public that should not be.
// =============================================================================

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
  /** Drive's own viewer URL. Internal: an outsider opening it hits a permission wall. */
  webViewLink: string | null
  /** The secret behind the public share route. Store it; never log it. */
  shareToken: string
}

/**
 * A fresh share token.
 *
 * 24 random bytes - 192 bits, base64url so it survives a URL untouched. The
 * token IS the credential, and the route it guards has no second factor and no
 * sign-in, so it has to be wide enough that guessing is not a strategy. A uuid
 * would have done, but a uuid LOOKS like an id and invites being logged or
 * pasted into a ticket the way our other ids are.
 */
export function newShareToken(): string {
  return randomBytes(24).toString("base64url")
}

/** The public URL a token resolves to. The one place this shape is written. */
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
 * Put a video in the project's Drive folder and mint its share token.
 *
 * The file itself stays PRIVATE in Drive. Sharing is this app's job: the token
 * returned here is what /api/public/share/<token> exchanges for a stream, which
 * is both what this Workspace allows (it refuses public Drive files outright)
 * and the narrower grant - one video, revocable, rather than a permission handed
 * to the whole internet that we cannot take back.
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

/**
 * Un-publish and trash a Drive-hosted asset.
 *
 * Order matters: revoke first. Trashing alone does NOT stop Drive serving the
 * URL to everyone who already saved it, so dropping our row without revoking
 * would leave a public video behind with nothing in this app pointing at it.
 */
export async function deleteVideoAsset(driveFileId: string): Promise<void> {
  await revokeAnyoneAccess(driveFileId).catch(() => {})
  await trashDriveFile(driveFileId)
}
