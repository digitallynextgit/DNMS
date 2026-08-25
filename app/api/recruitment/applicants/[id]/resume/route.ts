import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import { ensureBucket, uploadFile, getObjectKey, getSignedUrl } from "@/lib/storage"
import type { Session } from "next-auth"

const RESUME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB
const ONE_YEAR = 60 * 60 * 24 * 365

/**
 * GET /api/recruitment/applicants/[id]/resume - open the CV.
 *
 * A STABLE url that mints a fresh signature on every request and redirects to
 * it (API-07). The stored `resumeUrl` is a presigned link and B2 caps a
 * signature at 7 days however long is requested, so linking to it directly
 * meant every CV 403'd a week after upload.
 *
 * `resumeUrl` is also a free-text field on the applicant form, so it can hold
 * an external link (a LinkedIn profile, a Drive share) with no object behind
 * it. Those have no `resumeKey` and are passed through untouched.
 */
export const GET = withAuth(
  PERMISSIONS.RECRUITMENT_READ,
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    const { id } = ctx.params
    const applicant = await db.applicant.findUnique({
      where: { id },
      select: { resumeKey: true, resumeUrl: true },
    })
    if (!applicant) return NextResponse.json({ error: "Applicant not found" }, { status: 404 })

    if (applicant.resumeKey) {
      // Short-lived on purpose: the link is generated per click, so it never
      // needs to outlive the click.
      const fresh = await getSignedUrl(applicant.resumeKey, 300)
      return NextResponse.redirect(fresh, 307)
    }
    if (applicant.resumeUrl) return NextResponse.redirect(applicant.resumeUrl, 307)
    return NextResponse.json({ error: "No resume on file" }, { status: 404 })
  },
)

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
      // The KEY is what gets persisted (API-07). B2 caps a signature at 7 days
      // whatever lifetime you ask for, so the ONE_YEAR url stored here used to
      // start 403-ing a week after upload and the CV was simply gone. The url is
      // still written so anything reading the column directly keeps working, but
      // readers should mint a fresh one from resumeKey.
      const url = await getSignedUrl(objectKey, ONE_YEAR)

      await db.applicant.update({
        where: { id },
        data: { resumeKey: objectKey, resumeUrl: url },
      })
      return NextResponse.json({ data: { url } })
    } catch (error) {
      console.error("[APPLICANT_RESUME_POST]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
