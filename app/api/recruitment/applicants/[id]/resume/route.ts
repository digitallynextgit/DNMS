import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { withAuth } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import { ensureBucket, uploadFile, getObjectKey, getSignedUrl } from "@/lib/storage"
import type { Session } from "next-auth"

const RESUME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]
const MAX_BYTES = 10 * 1024 * 1024
const ONE_YEAR = 60 * 60 * 24 * 365

// POST /api/recruitment/applicants/[id]/resume - upload a resume file.
export const POST = withAuth(
  PERMISSIONS.RECRUITMENT_WRITE,
  async (req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const { id } = ctx.params
      const applicant = await db.applicant.findUnique({ where: { id }, select: { id: true } })
      if (!applicant) return NextResponse.json({ error: "Applicant not found" }, { status: 404 })

      const form = await req.formData()
      const file = form.get("file")
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
      }
      if (!RESUME_TYPES.includes(file.type)) {
        return NextResponse.json(
          { error: "Resume must be a PDF or Word document" },
          { status: 415 },
        )
      }
      if (file.size > MAX_BYTES) {
        return NextResponse.json({ error: "Resume must be 10 MB or smaller" }, { status: 413 })
      }

      const objectKey = getObjectKey(`resumes/${id}`, file.name, crypto.randomUUID())
      await ensureBucket()
      await uploadFile(objectKey, Buffer.from(await file.arrayBuffer()), file.type, file.size)
      const url = await getSignedUrl(objectKey, ONE_YEAR)

      await db.applicant.update({ where: { id }, data: { resumeUrl: url } })
      return NextResponse.json({ data: { url } })
    } catch (error) {
      console.error("[APPLICANT_RESUME_POST]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
