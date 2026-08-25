import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import type { Session } from "next-auth"

/** Most applicants in one pipeline response. Reported via meta.truncated. */
const APPLICANT_LIMIT = 500

export const GET = withAuth(
  PERMISSIONS.RECRUITMENT_READ,
  async (req: NextRequest, _ctx: unknown, _session: Session) => {
    try {
      const { searchParams } = req.nextUrl
      const jobId = searchParams.get("jobId") ?? undefined
      const stage = searchParams.get("stage") ?? undefined

      // Bounded: this was every applicant ever, each with every interview
      // nested - thousands of PII rows in one response. `createdAt desc` was
      // already the order, so the cap keeps the NEWEST, which is what the
      // pipeline view wants.
      const rows = await db.applicant.findMany({
        where: {
          ...(jobId && { jobPostingId: jobId }),
          ...(stage && { stage: stage as never }),
        },
        orderBy: { createdAt: "desc" },
        take: APPLICANT_LIMIT + 1,
        include: {
          jobPosting: { select: { title: true } },
          interviews: { orderBy: { scheduledAt: "asc" } },
        },
      })
      const truncated = rows.length > APPLICANT_LIMIT
      if (truncated) rows.length = APPLICANT_LIMIT
      return NextResponse.json({
        data: rows,
        meta: { truncated, limit: APPLICANT_LIMIT },
      })
    } catch (error) {
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

export const POST = withAuth(
  PERMISSIONS.RECRUITMENT_WRITE,
  async (req: NextRequest, _ctx: unknown, session: Session) => {
    try {
      const body = await req.json()
      const { jobId, firstName, lastName, email, phone, resumeUrl, source, notes } = body

      const applicant = await db.applicant.create({
        data: {
          jobPostingId: jobId,
          firstName,
          lastName,
          email,
          phone: phone || null,
          resumeUrl: resumeUrl || null,
          source: source || null,
          notes: notes || null,
          stage: "APPLIED",
        },
      })
      return NextResponse.json({ data: applicant }, { status: 201 })
    } catch (error) {
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
