import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { withSession, withAuth } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import type { Session } from "next-auth"

export const GET = withSession(
  async (req: NextRequest, _ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const includeInactive = new URL(req.url).searchParams.get("includeInactive") === "true"
      const kpis = await db.kpi.findMany({
        where: includeInactive ? undefined : { isActive: true },
        orderBy: { createdAt: "asc" },
      })
      return NextResponse.json({ data: kpis })
    } catch (error) {
      console.error("[KPIS_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

export const POST = withAuth(
  PERMISSIONS.PERFORMANCE_REVIEW,
  async (req: NextRequest, _ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const { name, description, weight } = await req.json()
      if (!name?.trim()) {
        return NextResponse.json({ error: "Name is required" }, { status: 400 })
      }
      const kpi = await db.kpi.create({
        data: {
          name: String(name).trim(),
          description: description || null,
          weight: weight != null ? Math.max(1, Number(weight)) : 1,
        },
      })
      return NextResponse.json({ data: kpi }, { status: 201 })
    } catch (error) {
      console.error("[KPIS_POST]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
