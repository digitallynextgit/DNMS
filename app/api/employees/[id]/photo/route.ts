import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { withSession, hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import { ensureBucket, uploadFile, getObjectKey, getSignedUrl } from "@/lib/storage"
import type { Session } from "next-auth"

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
const MAX_PHOTO_BYTES = 5 * 1024 * 1024 // 5 MB
const ONE_YEAR = 60 * 60 * 24 * 365

/** POST /api/employees/[id]/photo - upload a profile photo (self or HR). */
export const POST = withSession(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { id } = ctx.params
      const isSelf = session.user.id === id
      if (!isSelf && !hasPermission(session, PERMISSIONS.EMPLOYEE_WRITE)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
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

      const objectKey = getObjectKey(`profile-photos/${id}`, file.name, crypto.randomUUID())
      const buffer = Buffer.from(await file.arrayBuffer())
      await ensureBucket()
      await uploadFile(objectKey, buffer, file.type, file.size)
      const url = await getSignedUrl(objectKey, ONE_YEAR)

      await db.employee.update({ where: { id }, data: { profilePhoto: url } })
      return NextResponse.json({ data: { url } })
    } catch (error) {
      console.error("[EMPLOYEE_PHOTO_POST]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
