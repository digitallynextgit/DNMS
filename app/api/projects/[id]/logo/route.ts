import { NextRequest, NextResponse } from "next/server"
import sharp from "sharp"
import { db } from "@/server/db"
import { withProjectAccess, withProjectManager } from "@/features/projects/server/project-access"
import { isB2Configured, uploadFile, deleteFile, getObjectKey, getSignedUrl } from "@/lib/storage"

// Mirrors app/api/employees/[id]/photo - same private-bucket-plus-signed-redirect
// approach, same caching, same downscale-before-store. Kept deliberately parallel
// so the two behave identically rather than drifting.

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"]
const MAX_LOGO_BYTES = 5 * 1024 * 1024 // 5 MB

// Logos render at 24-64px on cards and ~40px in the project header. 512 covers
// every one of those at 2x DPI.
const LOGO_MAX_DIM = 512
const LOGO_QUALITY = 85

/**
 * Downscale + re-encode to WebP. `fit: "inside"` (not "cover"): a logo must not
 * be cropped to a square the way an avatar can be - a wide wordmark would lose
 * its ends. Falls back to the original bytes if the image can't be processed, so
 * an upload never hard-fails on a resize error.
 */
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

// ---------------------------------------------------------------------------
// Signed-URL cache - a project list paints many logos at once, and both the DB
// lookup and the B2 presign are pure functions of the object key. Keyed on the
// key, which changes on every upload, so a new logo can't be served from a
// stale entry.
// ---------------------------------------------------------------------------
// THE SIGNATURE MUST OUTLIVE THE CACHE WINDOW.
// This shipped as a 1-hour signature behind a 7-day immutable cache: the browser
// replayed the cached redirect long after B2 stopped honouring it, so avatars
// died an hour after first load and a reload could not fix them -
// means "do not revalidate", even on refresh. Sign for the SigV4 maximum and let
// the cache lapse a day earlier, so a cached redirect is always still valid.
const SIGNED_TTL_SECONDS = 7 * 24 * 60 * 60
const CACHE_SECONDS = 6 * 24 * 60 * 60
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>()

async function cachedSignedUrl(objectKey: string): Promise<string> {
  const hit = signedUrlCache.get(objectKey)
  // Re-sign a minute early so we never hand out a URL that expires mid-flight.
  if (hit && hit.expiresAt > Date.now() + 60_000) return hit.url
  const url = await getSignedUrl(objectKey, SIGNED_TTL_SECONDS)
  signedUrlCache.set(objectKey, { url, expiresAt: Date.now() + SIGNED_TTL_SECONDS * 1000 })
  return url
}

const logoKeyCache = new Map<string, string | null>()

function invalidate(projectId: string, objectKey?: string | null) {
  logoKeyCache.delete(projectId)
  if (objectKey) signedUrlCache.delete(objectKey)
}

/** Best-effort B2 delete - storage cleanup must never break the request. */
async function deleteQuietly(key: string | null | undefined) {
  if (!key) return
  await deleteFile(key).catch((e) => console.error("[project-logo] B2 delete failed:", key, e))
}

/**
 * GET /api/projects/[id]/logo - redirect to a presigned B2 URL.
 * Readable by anyone who can see the project, so logos render on the list.
 */
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
  // The stored URL carries ?v=<timestamp>, so caching hard is safe for its
  // version and the browser can cache it hard.
  return NextResponse.redirect(url, {
    status: 302,
    headers: { "Cache-Control": `private, max-age=${CACHE_SECONDS}` },
  })
})

/** POST /api/projects/[id]/logo - upload or replace. Managers/owner only. */
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
  // SVG is already tiny and resolution-independent; running it through sharp
  // would rasterise it and lose that, so it is stored as-is.
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

/** DELETE /api/projects/[id]/logo - remove it and reclaim the B2 object. */
export const DELETE = withProjectManager(async (_req, { params }) => {
  const { id } = params
  const existing = await db.project.findUnique({ where: { id }, select: { logoKey: true } })

  await db.project.update({ where: { id }, data: { logo: null, logoKey: null } })

  invalidate(id, existing?.logoKey)
  await deleteQuietly(existing?.logoKey)

  return NextResponse.json({ data: { ok: true } })
})
