import { NextRequest, NextResponse } from "next/server"
import sharp from "sharp"
import { db } from "@/server/db"
import { withProjectManager } from "@/features/projects/server/project-access"
import { isB2Configured, uploadFile, getObjectKey } from "@/lib/storage"
import { getConfig } from "@/server/app-config"
import { mailerImageUrl } from "@/features/project-mailer/lib/image-url"

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
const MAX_BYTES = 10 * 1024 * 1024

// Emails render at roughly 600px; 1200 covers that at 2x DPI. Anything larger is
// weight every single recipient downloads, on mobile data, for no visible gain.
const MAX_DIM = 1200
const QUALITY = 82

/**
 * POST /api/projects/:id/mailer/images - upload an image for use in a template
 * or campaign body. Returns the PUBLIC url to drop into an <img src>.
 */
export const POST = withProjectManager(async (req: NextRequest, { params }, session) => {
  if (!(await isB2Configured())) {
    return NextResponse.json({ error: "Backblaze B2 storage is not configured." }, { status: 500 })
  }

  const form = await req.formData()
  const file = form.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
  }
  if (!IMAGE_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Only JPG, PNG, WEBP or GIF" }, { status: 415 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image must be 10 MB or smaller" }, { status: 413 })
  }

  const original = Buffer.from(await file.arrayBuffer())

  // GIFs are left alone: sharp would flatten an animation to its first frame.
  // Everything else is downscaled to a JPEG - WebP still isn't safe in Outlook.
  let bytes = original
  let contentType = file.type
  let ext = file.type.split("/")[1] ?? "jpg"

  if (file.type !== "image/gif") {
    try {
      bytes = await sharp(original)
        .rotate()
        .resize(MAX_DIM, MAX_DIM, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: QUALITY, mozjpeg: true })
        .toBuffer()
      contentType = "image/jpeg"
      ext = "jpg"
    } catch (e) {
      console.error("[mailer-image] resize failed, storing original:", e)
    }
  }

  const objectKey = getObjectKey(`mailer-images/${params.id}`, `image.${ext}`, crypto.randomUUID())
  await uploadFile(objectKey, bytes, contentType)

  const asset = await db.projectMailerAsset.create({
    data: {
      projectId: params.id,
      objectKey,
      fileName: file.name.slice(0, 200),
      contentType,
      size: bytes.length,
      createdById: session.user.id,
    },
    select: { id: true, fileName: true, size: true },
  })

  // Absolute URL: a mail client has no origin to resolve "/api/..." against.
  //
  // APP_URL FIRST, matching every other outbound link in the app. Reading
  // NEXTAUTH_URL first sent a real campaign with "http://localhost:3000" in the
  // <img src> - a value that is correct on the machine composing the email and
  // unreachable for every single person receiving it.
  const origin = (await getConfig("APP_URL")) ?? process.env.NEXTAUTH_URL ?? req.nextUrl.origin
  return NextResponse.json({
    data: { ...asset, url: mailerImageUrl(origin, asset.id) },
  })
})
