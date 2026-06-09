import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { withSession } from "@/lib/permissions"
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

export const GET = withSession(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const job = await db.jobPosting.findUnique({
        where: { id: ctx.params.id },
        include: {
          department: { select: { name: true } },
          postedBy: { select: { firstName: true, lastName: true } },
          applicants: {
            orderBy: { createdAt: "desc" },
            include: {
              interviews: { orderBy: { scheduledAt: "asc" } },
            },
          },
        },
      })
      if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 })
      return NextResponse.json({ data: job })
    } catch (error) {
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

export const PATCH = withSession(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const body = await req.json()
      const job = await db.jobPosting.update({
        where: { id: ctx.params.id },
        data: {
          ...(body.title !== undefined && { title: body.title }),
          ...(body.slug !== undefined && {
            slug:
              emptyToNull(body.slug) ??
              (typeof body.title === "string" ? slugifyCareer(body.title) : null),
          }),
          ...(body.description !== undefined && { description: body.description }),
          ...(body.departmentId !== undefined && { departmentId: body.departmentId || null }),
          ...(body.location !== undefined && { location: body.location || null }),
          ...(body.type !== undefined && { type: body.type }),
          ...(body.salaryMin !== undefined && {
            salaryMin: body.salaryMin ? parseFloat(body.salaryMin) : null,
          }),
          ...(body.salaryMax !== undefined && {
            salaryMax: body.salaryMax ? parseFloat(body.salaryMax) : null,
          }),
          ...(body.closingDate !== undefined && {
            closingDate: body.closingDate ? new Date(body.closingDate) : null,
          }),
          ...(body.status !== undefined && { status: body.status as never }),
          ...(body.meta !== undefined && { meta: emptyToNull(body.meta) }),
          ...(body.summary !== undefined && { summary: emptyToNull(body.summary) }),
          ...(body.intro !== undefined && { intro: emptyToNull(body.intro) }),
          ...(body.jobEssence !== undefined && { jobEssence: emptyToNull(body.jobEssence) }),
          ...(body.keyRequirements !== undefined && {
            keyRequirements: asStringArray(body.keyRequirements),
          }),
          ...(body.currentOpenings !== undefined && {
            currentOpenings: asStringArray(body.currentOpenings),
          }),
          ...(body.publishToCareers !== undefined && {
            publishToCareers: Boolean(body.publishToCareers),
          }),
        },
      })
      return NextResponse.json({ data: job })
    } catch (error) {
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

export const DELETE = withSession(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      await db.jobPosting.delete({ where: { id: ctx.params.id } })
      return NextResponse.json({ message: "Job posting deleted" })
    } catch (error) {
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
