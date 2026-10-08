import { NextRequest, NextResponse } from "next/server"
import sharp from "sharp"
import { db } from "@/server/db"
import { withProjectAccess, withProjectManager } from "@/features/projects/server/project-access"
import { isB2Configured, uploadFile, deleteFile, getObjectKey, getSignedUrl } from "@/lib/storage"

// Kept parallel to app/api/employees/[id]/photo (signed redirect, caching, downscale) so they don't drift.

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"]
const MAX_LOGO_BYTES = 5 * 1024 * 1024

// Logos render at 24-64px; 512 covers that at 2x DPI.
const LOGO_MAX_DIM = 512
const LOGO_QUALITY = 85

/** Downscale to WebP with fit "inside" so wide wordmarks aren't cropped; falls back to the original bytes. */
async function toThumbnail(
  buffer: Buffer,
  fallbackType: string,
): Promise<{ buffer: Buffer; contentType: string; ext: string }> {
  try {
    const out = await sharp(buffer)
      .rotate()
      .resize(LOGO_MAX_DIM, LOGO_MAX_DIM, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: LOGO_QUALITY })
      .toBuffer()
    return { buffer: out, contentType: "image/webp", ext: "webp" }
  } catch (e) {
    console.error("[project-logo] resize failed, storing original:", e)
    return { buffer, contentType: fallbackType, ext: fallbackType.split("/")[1] ?? "png" }
  }
}

// The signature MUST outlive the browser cache window, or cached redirects start serving 403s.
const SIGNED_TTL_SECONDS = 7 * 24 * 60 * 60
const CACHE_SECONDS = 6 * 24 * 60 * 60
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>()

async function cachedSignedUrl(objectKey: string): Promise<string> {
  const hit = signedUrlCache.get(objectKey)
  // Reuse only while the URL outlives a full browser cache window, or viewers replay a dead redirect.
  if (hit && hit.expiresAt > Date.now() + (CACHE_SECONDS + 60) * 1000) return hit.url
  // SVG is served as an attachment so a script inside a malicious logo never runs on the storage origin.
  const isSvg = objectKey.toLowerCase().endsWith(".svg")
  const url = await getSignedUrl(
    objectKey,
    SIGNED_TTL_SECONDS,
    isSvg ? { downloadFileName: "logo.svg" } : undefined,
  )
  signedUrlCache.set(objectKey, { url, expiresAt: Date.now() + SIGNED_TTL_SECONDS * 1000 })
  return url
}

const logoKeyCache = new Map<string, string | null>()

function invalidate(projectId: string, objectKey?: string | null) {
  logoKeyCache.delete(projectId)
  if (objectKey) signedUrlCache.delete(objectKey)
}

async function deleteQuietly(key: string | null | undefined) {
  if (!key) return
  await deleteFile(key).catch((e) => console.error("[project-logo] B2 delete failed:", key, e))
}

// Readable by anyone who can see the project, so logos render on the list.
export const GET = withProjectAccess(async (_req, { params }) => {
  const { id } = params

  let logoKey = logoKeyCache.get(id)
  if (logoKey === undefined) {
    const project = await db.project.findUnique({ where: { id }, select: { logoKey: true } })
    logoKey = project?.logoKey ?? null
    logoKeyCache.set(id, logoKey)
  }
  if (!logoKey) return NextResponse.json({ error: "No logo" }, { status: 404 })

  const url = await cachedSignedUrl(logoKey)
  // ?v=<timestamp> changes on every upload, so caching hard is safe.
  return NextResponse.redirect(url, {
    status: 302,
    headers: { "Cache-Control": `private, max-age=${CACHE_SECONDS}` },
  })
})

export const POST = withProjectManager(async (req: NextRequest, { params }) => {
  const { id } = params
  if (!(await isB2Configured())) {
    return NextResponse.json({ error: "Backblaze B2 storage is not configured." }, { status: 500 })
  }

  const form = await req.formData()
  const file = form.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
  }
  if (!IMAGE_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Only JPG, PNG, WEBP, GIF or SVG" }, { status: 415 })
  }
  if (file.size > MAX_LOGO_BYTES) {
    return NextResponse.json({ error: "Logo must be 5 MB or smaller" }, { status: 413 })
  }

  const existing = await db.project.findUnique({ where: { id }, select: { logoKey: true } })

  const original = Buffer.from(await file.arrayBuffer())
  // SVG is stored as-is; sharp would rasterise it.
  const stored =
    file.type === "image/svg+xml"
      ? { buffer: original, contentType: file.type, ext: "svg" }
      : await toThumbnail(original, file.type)

  const objectKey = getObjectKey(`project-logos/${id}`, `logo.${stored.ext}`, crypto.randomUUID())
  await uploadFile(objectKey, stored.buffer, stored.contentType)

  const url = `/api/projects/${id}/logo?v=${Date.now()}`
  await db.project.update({ where: { id }, data: { logo: url, logoKey: objectKey } })

  invalidate(id, existing?.logoKey)
  await deleteQuietly(existing?.logoKey)

  return NextResponse.json({ data: { url } })
})

export const DELETE = withProjectManager(async (_req, { params }) => {
  const { id } = params
  const existing = await db.project.findUnique({ where: { id }, select: { logoKey: true } })

  await db.project.update({ where: { id }, data: { logo: null, logoKey: null } })

  invalidate(id, existing?.logoKey)
  await deleteQuietly(existing?.logoKey)

  return NextResponse.json({ data: { ok: true } })
})
