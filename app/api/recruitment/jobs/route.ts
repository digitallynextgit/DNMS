import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { withSession } from "@/lib/permissions"
import { createAuditLog } from "@/lib/audit"
import { slugifyCareer } from "@/lib/careers-types"
import type { Session } from "next-auth"

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((v) => (typeof v === "string" ? v.trim() : "")).filter((v) => v.length > 0)
}

function emptyToNull(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export const GET = withSession(async (req: NextRequest, _ctx: unknown, _session: Session) => {
  try {
    const { searchParams } = req.nextUrl
    const status = searchParams.get("status") ?? undefined

    const jobs = await db.jobPosting.findMany({
      where: { ...(status && { status: status as never }) },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { applicants: true } },
        department: { select: { name: true } },
      },
    })
    return NextResponse.json({ data: jobs })
  } catch (error) {
    console.error("[JOBS_GET]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})

export const POST = withSession(async (req: NextRequest, _ctx: unknown, session: Session) => {
  try {
    const body = await req.json()
    const {
      title,
      description,
      departmentId,
      location,
      type,
      salaryMin,
      salaryMax,
      closingDate,
      status,
      slug,
      meta,
      summary,
      intro,
      jobEssence,
      keyRequirements,
      currentOpenings,
      publishToCareers,
    } = body

    const titleStr = typeof title === "string" ? title.trim() : ""
    const resolvedSlug = emptyToNull(slug) ?? (titleStr ? slugifyCareer(titleStr) : null)

    const job = await db.jobPosting.create({
      data: {
        title: titleStr,
        slug: resolvedSlug,
        description: emptyToNull(description),
        departmentId: emptyToNull(departmentId),
        location: emptyToNull(location),
        type: type || "FULL_TIME",
        salaryMin: salaryMin ? parseFloat(salaryMin) : null,
        salaryMax: salaryMax ? parseFloat(salaryMax) : null,
        closingDate: closingDate ? new Date(closingDate) : null,
        status: (status || "DRAFT") as never,
        postedById: session.user.id,
        meta: emptyToNull(meta),
        summary: emptyToNull(summary),
        intro: emptyToNull(intro),
        jobEssence: emptyToNull(jobEssence),
        keyRequirements: asStringArray(keyRequirements),
        currentOpenings: asStringArray(currentOpenings),
        publishToCareers: Boolean(publishToCareers),
      },
    })

    await createAuditLog(session, {
      action: "CREATE",
      module: "recruitment",
      entityType: "JobPosting",
      entityId: job.id,
    })

    return NextResponse.json({ data: job }, { status: 201 })
  } catch (error) {
    console.error("[JOBS_POST]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})
