import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { withSession } from "@/lib/permissions"
import type { Session } from "next-auth"

export const GET = withSession(async (req: NextRequest, _ctx: unknown, _session: Session) => {
  try {
    const { searchParams } = req.nextUrl
    const jobId = searchParams.get("jobId") ?? undefined
    const stage = searchParams.get("stage") ?? undefined

    const applicants = await db.applicant.findMany({
      where: {
        ...(jobId && { jobPostingId: jobId }),
        ...(stage && { stage: stage as never }),
      },
      orderBy: { createdAt: "desc" },
      include: {
        jobPosting: { select: { title: true } },
        interviews: { orderBy: { scheduledAt: "asc" } },
      },
    })
    return NextResponse.json({ data: applicants })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})

export const POST = withSession(async (req: NextRequest, _ctx: unknown, session: Session) => {
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
})
