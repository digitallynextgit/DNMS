import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import { isB2Configured, uploadFile, deleteFile, getObjectKey, getSignedUrl } from "@/lib/b2"
import type { Session } from "next-auth"

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
const MAX_PHOTO_BYTES = 5 * 1024 * 1024 // 5 MB

function canEdit(session: Session, id: string): boolean {
  return session.user.id === id || hasPermission(session, PERMISSIONS.EMPLOYEE_WRITE)
}

// Best-effort B2 delete — never let storage cleanup failures break the request.
async function deleteQuietly(key: string | null | undefined) {
  if (!key) return
  await deleteFile(key).catch((e) => console.error("[photo] B2 delete failed:", key, e))
}

/**
 * GET /api/employees/[id]/photo - redirect to a short-lived presigned B2 URL.
 * profilePhoto stores this stable route URL, so <img> tags resolve a fresh signed
 * URL on each load without ever exposing the private bucket directly.
 */
export const GET = withSession(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { id } = ctx.params
      const emp = await db.employee.findUnique({
        where: { id },
        select: { profilePhotoKey: true },
      })
      if (!emp?.profilePhotoKey) {
        return NextResponse.json({ error: "No photo" }, { status: 404 })
      }
      const url = await getSignedUrl(emp.profilePhotoKey, 3600)
      // 302 to the signed URL; allow brief private caching (the route URL is
      // cache-busted with ?v= on every change, so this never serves a stale photo).
      return NextResponse.redirect(url, {
        status: 302,
        headers: { "Cache-Control": "private, max-age=300" },
      })
    } catch (error) {
      console.error("[EMPLOYEE_PHOTO_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

/** POST /api/employees/[id]/photo - upload/replace a profile photo (self or HR). */
export const POST = withSession(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { id } = ctx.params
      if (!canEdit(session, id)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      if (!isB2Configured()) {
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

      const objectKey = getObjectKey(`profile-photos/${id}`, file.name, crypto.randomUUID())
      const buffer = Buffer.from(await file.arrayBuffer())
      await uploadFile(objectKey, buffer, file.type)

      // Stable serve URL + version param so cached <img>s refresh after a change.
      const url = `/api/employees/${id}/photo?v=${Date.now()}`
      await db.employee.update({
        where: { id },
        data: { profilePhoto: url, profilePhotoKey: objectKey },
      })

      // Reclaim space: drop the previous B2 object now that the new one is live.
      await deleteQuietly(existing?.profilePhotoKey)

      return NextResponse.json({ data: { url } })
    } catch (error) {
      console.error("[EMPLOYEE_PHOTO_POST]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

/** DELETE /api/employees/[id]/photo - remove the photo and delete the B2 object. */
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
      await deleteQuietly(existing?.profilePhotoKey)
      return NextResponse.json({ data: { ok: true } })
    } catch (error) {
      console.error("[EMPLOYEE_PHOTO_DELETE]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
