import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import { isB2Configured, uploadFile, getObjectKey } from "@/lib/storage"
import { resizeImage } from "@/lib/image-resize"
import { resolveAlbumId } from "@/features/noticeboard/server/album-slug"

export const runtime = "nodejs"

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
const MAX_BYTES = 15 * 1024 * 1024
/** Gallery photos are viewed full-screen, so they keep more resolution than an
 *  email image - but a 6000px phone photo is still pure download weight. */
const MAX_DIM = 2000
const QUALITY = 82

/**
 * POST /api/gallery/albums/:albumId/photos - upload one or more photos.
 *
 * Multiple files per request: a Diwali album is thirty photos, and thirty
 * round trips is thirty chances for one to fail halfway.
 */
export const POST = withAuth(PERMISSIONS.GALLERY_WRITE, async (req: NextRequest, ctx, session) => {
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
    if (!IMAGE_TYPES.includes(file.type)) {
      skipped.push({ fileName: file.name, reason: "Not a JPG, PNG, WEBP or GIF" })
      continue
    }
    if (file.size > MAX_BYTES) {
      skipped.push({ fileName: file.name, reason: "Larger than 15 MB" })
      continue
    }

    const original = Buffer.from(await file.arrayBuffer())
    const { bytes, contentType, ext, width, height } = await resizeImage(original, file.type, {
      maxDim: MAX_DIM,
      quality: QUALITY,
    })

    const objectKey = getObjectKey(`gallery/${albumId}`, `photo.${ext}`, crypto.randomUUID())
    await uploadFile(objectKey, bytes, contentType)

    const photo = await db.photo.create({
      data: {
        albumId,
        objectKey,
        fileName: file.name.slice(0, 200),
        contentType,
        size: bytes.length,
        width,
        height,
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
