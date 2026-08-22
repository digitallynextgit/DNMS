import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { isB2Configured, uploadFile, getObjectKey } from "@/lib/storage"
import { resizeImage } from "@/lib/image-resize"
import { resolveAlbumId } from "@/features/noticeboard/server/album-slug"

export const runtime = "nodejs"

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
/** Phone cameras record .mov (quicktime); mp4/webm cover everything else. */
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"]

const MAX_IMAGE_BYTES = 15 * 1024 * 1024
/**
 * Videos are stored exactly as uploaded (no server-side transcode), so this cap
 * is the real ceiling on what lands in the bucket. Kept below
 * `proxyClientMaxBodySize` (260 MB, next.config.mjs) with room for the multipart
 * envelope - above that the body is truncated and formData() dies on the missing
 * boundary rather than returning a clean "too large".
 */
const MAX_VIDEO_BYTES = 200 * 1024 * 1024

/** Gallery photos are viewed full-screen, so they keep more resolution than an
 *  email image - but a 6000px phone photo is still pure download weight. */
const MAX_DIM = 2000
const QUALITY = 82

const VIDEO_EXT: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
}

interface StoredFile {
  bytes: Buffer
  contentType: string
  ext: string
  width: number | null
  height: number | null
}

/**
 * POST /api/gallery/albums/:albumId/photos - upload one or more photos/videos.
 *
 * Open to EVERY signed-in employee (withSession), not just gallery:write: the
 * gallery is the company's shared album, and the people at the event are the
 * ones holding the photos. Destructive actions stay privileged - deleting an
 * album still needs gallery:write, and an employee may only delete their own
 * uploads.
 *
 * Multiple files per request: a Diwali album is thirty photos, and thirty
 * round trips is thirty chances for one to fail halfway.
 */
export const POST = withSession(async (req: NextRequest, ctx, session) => {
  if (!(await isB2Configured())) {
    return NextResponse.json({ error: "Backblaze B2 storage is not configured." }, { status: 500 })
  }
  // Resolve BEFORE using it: this route writes albumId onto every photo row and
  // into the object key. Storing the slug there would break the foreign key and
  // scatter files under a path that stops matching the moment anything changes.
  const albumId = await resolveAlbumId(ctx.params.albumId)
  if (!albumId) return NextResponse.json({ error: "Album not found" }, { status: 404 })

  const form = await req.formData()
  const files = form.getAll("files").filter((f): f is File => f instanceof File)
  if (files.length === 0) return NextResponse.json({ error: "No files uploaded" }, { status: 400 })

  const created: { id: string; fileName: string }[] = []
  const skipped: { fileName: string; reason: string }[] = []

  for (const file of files) {
    const isVideo = VIDEO_TYPES.includes(file.type)
    const isImage = IMAGE_TYPES.includes(file.type)
    if (!isImage && !isVideo) {
      skipped.push({
        fileName: file.name,
        reason: "Not an image (JPG, PNG, WEBP, GIF) or video (MP4, WEBM, MOV)",
      })
      continue
    }

    const cap = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
    if (file.size > cap) {
      skipped.push({ fileName: file.name, reason: `Larger than ${cap / 1024 / 1024} MB` })
      continue
    }

    const original = Buffer.from(await file.arrayBuffer())
    // Videos go up byte-for-byte: sharp cannot touch them, and transcoding on
    // the request thread would hold a 200 MB buffer for minutes.
    const stored: StoredFile = isVideo
      ? {
          bytes: original,
          contentType: file.type,
          ext: VIDEO_EXT[file.type] ?? "mp4",
          width: null,
          height: null,
        }
      : await resizeImage(original, file.type, { maxDim: MAX_DIM, quality: QUALITY })

    const objectKey = getObjectKey(
      `gallery/${albumId}`,
      `${isVideo ? "video" : "photo"}.${stored.ext}`,
      crypto.randomUUID(),
    )
    await uploadFile(objectKey, stored.bytes, stored.contentType)

    const photo = await db.photo.create({
      data: {
        albumId,
        objectKey,
        fileName: file.name.slice(0, 200),
        contentType: stored.contentType,
        size: stored.bytes.length,
        width: stored.width,
        height: stored.height,
        uploadedById: session.user.id,
      },
      select: { id: true, fileName: true },
    })
    created.push(photo)
  }

  // Partial success is reported, not hidden: 28 of 30 uploaded is useful to
  // know, and silently dropping two is how an album ends up incomplete.
  return NextResponse.json(
    { data: { uploaded: created.length, created, skipped } },
    { status: 201 },
  )
})
