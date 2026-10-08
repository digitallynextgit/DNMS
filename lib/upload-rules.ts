import {
  ALLOWED_FILE_TYPES,
  ALLOWED_FILE_EXTENSIONS,
  ALLOWED_VIDEO_TYPES,
  ALLOWED_VIDEO_EXTENSIONS,
} from "@/lib/constants"

// Upload type rules, shared by every upload path. `file.type` comes from the browser and is often
// empty, so a missing MIME falls back to the extension instead of skipping the check.

/** Lets the client refuse big files before uploading; the server cap (app/api/projects/[id]/resources) enforces it. */
export const MAX_UPLOAD_MB = 250
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024

type UploadLike = { name: string; type?: string }

const extensionOf = (name: string): string => {
  const i = name.lastIndexOf(".")
  return i < 0 ? "" : name.slice(i).toLowerCase()
}

/** A video, and therefore bound for Drive rather than Backblaze. */
export function isVideoUpload(file: UploadLike): boolean {
  if (file.type && ALLOWED_VIDEO_TYPES.includes(file.type)) return true
  return ALLOWED_VIDEO_EXTENSIONS.includes(extensionOf(file.name))
}

/** A document or image we accept into Backblaze (pdf / doc / docx / jpg / png / webp). */
export function isAllowedDocument(file: UploadLike): boolean {
  if (file.type) return ALLOWED_FILE_TYPES.includes(file.type)
  return ALLOWED_FILE_EXTENSIONS.includes(extensionOf(file.name))
}
