import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { withSession } from "@/lib/permissions"
import type { Session } from "next-auth"

export const GET = withSession(async (req: NextRequest, _ctx: unknown, _session: Session) => {
  try {
    const applicantId = req.nextUrl.searchParams.get("applicantId") ?? undefined
    const interviews = await db.interview.findMany({
      where: { ...(applicantId && { applicantId }) },
      orderBy: { scheduledAt: "asc" },
      include: {
        applicant: {
          select: { firstName: true, lastName: true, jobPosting: { select: { title: true } } },
        },
        interviewer: { select: { firstName: true, lastName: true } },
      },
    })
    return NextResponse.json({ data: interviews })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})

export const POST = withSession(async (req: NextRequest, _ctx: unknown, session: Session) => {
  try {
    const body = await req.json()
    const { applicantId, type, scheduledAt, interviewerId, notes } = body
    const interview = await db.interview.create({
      data: {
        applicantId,
        type: (type || "PHONE") as never,
        scheduledAt: new Date(scheduledAt),
        interviewerId: interviewerId || null,
        notes: notes || null,
        result: "PENDING" as never,
      },
    })
    return NextResponse.json({ data: interview }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})
