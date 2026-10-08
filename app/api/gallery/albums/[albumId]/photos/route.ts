import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { isB2Configured, uploadFile, getObjectKey } from "@/lib/storage"
import { resizeImage, makeThumb } from "@/lib/image-resize"
import { resolveAlbumId } from "@/features/noticeboard/server/album-slug"

export const runtime = "nodejs"

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
/** Phone cameras record .mov (quicktime); mp4/webm cover everything else. */
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"]

const MAX_IMAGE_BYTES = 15 * 1024 * 1024
// Videos are stored as uploaded, so this is the real cap. Keep it below proxyClientMaxBodySize
// (260 MB, next.config.mjs) or formData() fails instead of returning a clean "too large".
const MAX_VIDEO_BYTES = 200 * 1024 * 1024

/** Viewed full-screen, so larger than email images. */
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

// Open to every employee: the people at the event hold the photos. Deleting stays privileged.
export const POST = withSession(async (req: NextRequest, ctx, session) => {
  if (!(await isB2Configured())) {
    return NextResponse.json({ error: "Backblaze B2 storage is not configured." }, { status: 500 })
  }
  // Resolve the slug first: albumId goes into every photo row (FK) and into the object key.
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
    // Videos go up byte-for-byte; transcoding here would hold a 200 MB buffer for minutes.
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

    // Best-effort WebP thumbnail for grid/covers; on failure the grid falls back to the master.
    let thumbKey: string | null = null
    if (isImage) {
      const thumb = await makeThumb(original)
      if (thumb) {
        thumbKey = getObjectKey(
          `gallery/${albumId}/thumbs`,
          `thumb.${thumb.ext}`,
          crypto.randomUUID(),
        )
        await uploadFile(thumbKey, thumb.bytes, thumb.contentType)
      }
    }

    const photo = await db.photo.create({
      data: {
        albumId,
        objectKey,
        thumbKey,
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

  // Report partial success rather than silently dropping files.
  return NextResponse.json(
    { data: { uploaded: created.length, created, skipped } },
    { status: 201 },
  )
})
