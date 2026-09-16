import {
  ALLOWED_FILE_TYPES,
  ALLOWED_FILE_EXTENSIONS,
  ALLOWED_VIDEO_TYPES,
  ALLOWED_VIDEO_EXTENSIONS,
} from "@/lib/constants"

// =============================================================================
// "What kind of file is this, and may we take it?"
//
// Kept separate from where the bytes end up (lib/drive-media.ts) and from the
// storage clients, because every upload path needs to ask these two questions
// and they must answer the same way everywhere.
//
// ── WHY EXTENSIONS AS WELL AS MIME ───────────────────────────────────────────
// `file.type` is supplied by the BROWSER and is routinely an empty string - some
// browsers for drag-and-drop, most for files off a network share, and anything
// posting the multipart body by hand. The original check read
//
//     if (file.type && !ALLOWED_FILE_TYPES.includes(file.type)) reject
//
// which skips the allowlist entirely the moment the type is blank: a type-less
// .exe passed it. So a missing MIME falls back to the extension instead of
// waiving the rule.
// =============================================================================

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
