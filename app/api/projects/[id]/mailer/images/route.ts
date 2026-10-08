import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withMailerAccess } from "@/features/project-mailer/server/mailer-access"
import { authorColumns } from "@/features/project-mailer/server/project-mailer.service"
import { isB2Configured, uploadFile, getObjectKey } from "@/lib/storage"
import { resizeImage } from "@/lib/image-resize"
import { getConfig } from "@/server/app-config"
import { mailerImageUrl } from "@/features/project-mailer/lib/image-url"

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
const MAX_BYTES = 10 * 1024 * 1024

// Emails render at ~600px; 1200 covers that at 2x DPI.
const MAX_DIM = 1200
const QUALITY = 82

// Returns the PUBLIC url to drop into an <img src>.
export const POST = withMailerAccess(async (req: NextRequest, { params }, session) => {
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
  const { bytes, contentType, ext } = await resizeImage(original, file.type, {
    maxDim: MAX_DIM,
    quality: QUALITY,
  })

  const objectKey = getObjectKey(`mailer-images/${params.id}`, `image.${ext}`, crypto.randomUUID())
  await uploadFile(objectKey, bytes, contentType)

  const asset = await db.projectMailerAsset.create({
    data: {
      projectId: params.id,
      objectKey,
      fileName: file.name.slice(0, 200),
      contentType,
      size: bytes.length,
      ...authorColumns(session),
    },
    select: { id: true, fileName: true, size: true },
  })

  // Absolute URL, APP_URL first: mail clients can't resolve "/api/..." and NEXTAUTH_URL may be localhost.
  const origin = (await getConfig("APP_URL")) ?? process.env.NEXTAUTH_URL ?? req.nextUrl.origin
  return NextResponse.json({
    data: { ...asset, url: mailerImageUrl(origin, asset.id) },
  })
})
