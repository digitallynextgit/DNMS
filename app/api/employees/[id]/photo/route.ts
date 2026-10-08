import { NextRequest, NextResponse } from "next/server"
import sharp from "sharp"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import { isB2Configured, uploadFile, deleteFile, getObjectKey, getSignedUrl } from "@/lib/storage"
import { avatarPath, isValidAvatarId } from "@/lib/avatars"
import type { Session } from "next-auth"

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
const MAX_PHOTO_BYTES = 5 * 1024 * 1024

// Avatars render at 20-96px; 512px covers every size at 2x DPI.
const PHOTO_MAX_DIM = 512
const PHOTO_QUALITY = 80

/** Downscale to a small WebP; falls back to the original bytes if the image can't be processed. */
async function toThumbnail(
  buffer: Buffer,
  fallbackType: string,
): Promise<{ buffer: Buffer; contentType: string; ext: string }> {
  try {
    const out = await sharp(buffer)
      .rotate() // honour EXIF orientation before resizing
      .resize(PHOTO_MAX_DIM, PHOTO_MAX_DIM, { fit: "cover", withoutEnlargement: true })
      .webp({ quality: PHOTO_QUALITY })
      .toBuffer()
    return { buffer: out, contentType: "image/webp", ext: "webp" }
  } catch (e) {
    console.error("[photo] resize failed, storing original:", e)
    return { buffer, contentType: fallbackType, ext: fallbackType.split("/")[1] ?? "jpg" }
  }
}

// Signed URLs are cached per objectKey, which changes on every upload.
// The signature MUST outlive the browser cache window, or cached redirects start serving 403s.
const SIGNED_TTL_SECONDS = 7 * 24 * 60 * 60
const CACHE_SECONDS = 6 * 24 * 60 * 60
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>()

async function cachedSignedUrl(objectKey: string): Promise<string> {
  const hit = signedUrlCache.get(objectKey)
  // Reuse only while the URL outlives a full browser cache window, or viewers replay a dead redirect.
  if (hit && hit.expiresAt > Date.now() + (CACHE_SECONDS + 60) * 1000) return hit.url
  const url = await getSignedUrl(objectKey, SIGNED_TTL_SECONDS)
  signedUrlCache.set(objectKey, { url, expiresAt: Date.now() + SIGNED_TTL_SECONDS * 1000 })
  return url
}

// Cached too; upload and delete both clear the entry.
const photoKeyCache = new Map<string, string | null>()

function invalidatePhotoCaches(employeeId: string, objectKey?: string | null) {
  photoKeyCache.delete(employeeId)
  if (objectKey) signedUrlCache.delete(objectKey)
}

function canEdit(session: Session, id: string): boolean {
  return session.user.id === id || hasPermission(session, PERMISSIONS.EMPLOYEE_WRITE)
}

async function deleteQuietly(key: string | null | undefined) {
  if (!key) return
  await deleteFile(key).catch((e) => console.error("[photo] B2 delete failed:", key, e))
}

// profilePhoto stores this stable URL; it redirects to a presigned URL so the bucket stays private.
export const GET = withSession(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { id } = ctx.params

      let photoKey = photoKeyCache.get(id)
      if (photoKey === undefined) {
        const emp = await db.employee.findUnique({
          where: { id },
          select: { profilePhotoKey: true },
        })
        photoKey = emp?.profilePhotoKey ?? null
        photoKeyCache.set(id, photoKey)
      }
      if (!photoKey) {
        return NextResponse.json({ error: "No photo" }, { status: 404 })
      }

      const url = await cachedSignedUrl(photoKey)
      // ?v=<timestamp> changes on every upload, so caching hard is safe - but it must stay under the
      // signature lifetime above.
      return NextResponse.redirect(url, {
        status: 302,
        headers: { "Cache-Control": `private, max-age=${CACHE_SECONDS}` },
      })
    } catch (error) {
      console.error("[EMPLOYEE_PHOTO_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

export const POST = withSession(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { id } = ctx.params
      if (!canEdit(session, id)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      if (!(await isB2Configured())) {
        return NextResponse.json(
          { error: "Backblaze B2 storage is not configured." },
          { status: 500 },
        )
      }

      const form = await req.formData()
      const file = form.get("file")
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
      }
      if (!IMAGE_TYPES.includes(file.type)) {
        return NextResponse.json({ error: "Only JPG, PNG, WEBP or GIF images" }, { status: 415 })
      }
      if (file.size > MAX_PHOTO_BYTES) {
        return NextResponse.json({ error: "Image must be 5 MB or smaller" }, { status: 413 })
      }

      const existing = await db.employee.findUnique({
        where: { id },
        select: { profilePhotoKey: true },
      })

      const original = Buffer.from(await file.arrayBuffer())
      const thumb = await toThumbnail(original, file.type)

      const objectKey = getObjectKey(
        `profile-photos/${id}`,
        `photo.${thumb.ext}`,
        crypto.randomUUID(),
      )
      await uploadFile(objectKey, thumb.buffer, thumb.contentType)

      // Stable serve URL + version param so cached <img>s refresh after a change.
      const url = `/api/employees/${id}/photo?v=${Date.now()}`
      await db.employee.update({
        where: { id },
        data: { profilePhoto: url, profilePhotoKey: objectKey },
      })

      invalidatePhotoCaches(id, existing?.profilePhotoKey)

      await deleteQuietly(existing?.profilePhotoKey)

      return NextResponse.json({ data: { url } })
    } catch (error) {
      console.error("[EMPLOYEE_PHOTO_POST]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

// Presets are public paths: clear profilePhotoKey and reclaim any uploaded photo.
export const PUT = withSession(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { id } = ctx.params
      if (!canEdit(session, id)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      const { avatarId } = await req.json()
      if (!isValidAvatarId(avatarId)) {
        return NextResponse.json({ error: "Unknown avatar" }, { status: 422 })
      }

      const existing = await db.employee.findUnique({
        where: { id },
        select: { profilePhotoKey: true },
      })

      await db.employee.update({
        where: { id },
        data: { profilePhoto: avatarPath(avatarId), profilePhotoKey: null },
      })

      invalidatePhotoCaches(id, existing?.profilePhotoKey)
      await deleteQuietly(existing?.profilePhotoKey)

      return NextResponse.json({ data: { url: avatarPath(avatarId) } })
    } catch (error) {
      console.error("[EMPLOYEE_PHOTO_PUT]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

export const DELETE = withSession(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { id } = ctx.params
      if (!canEdit(session, id)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      const existing = await db.employee.findUnique({
        where: { id },
        select: { profilePhotoKey: true },
      })
      await db.employee.update({
        where: { id },
        data: { profilePhoto: null, profilePhotoKey: null },
      })
      invalidatePhotoCaches(id, existing?.profilePhotoKey)
      await deleteQuietly(existing?.profilePhotoKey)
      return NextResponse.json({ data: { ok: true } })
    } catch (error) {
      console.error("[EMPLOYEE_PHOTO_DELETE]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
