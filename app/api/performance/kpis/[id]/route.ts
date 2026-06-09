import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { withAuth } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import type { Session } from "next-auth"

export const PATCH = withAuth(
  PERMISSIONS.PERFORMANCE_REVIEW,
  async (req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const body = await req.json()
      const data: Record<string, unknown> = {}
      if (body.name !== undefined) data.name = String(body.name).trim()
      if (body.description !== undefined) data.description = body.description || null
      if (body.weight !== undefined) data.weight = Math.max(1, Number(body.weight))
      if (body.isActive !== undefined) data.isActive = !!body.isActive
      const kpi = await db.kpi.update({ where: { id: ctx.params.id }, data })
      return NextResponse.json({ data: kpi })
    } catch (error) {
      console.error("[KPI_PATCH]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

export const DELETE = withAuth(
  PERMISSIONS.PERFORMANCE_REVIEW,
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      await db.kpi.delete({ where: { id: ctx.params.id } })
      return NextResponse.json({ message: "KPI deleted" })
    } catch (error) {
      console.error("[KPI_DELETE]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
