import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { withProjectManager } from "@/features/projects/server/project-access"
import { getLatestMonitor, runDailyMonitor } from "@/features/seo/server/seo.monitor.service"
import { PERMISSIONS } from "@/lib/constants"
import type { Session } from "next-auth"

export const runtime = "nodejs"
export const maxDuration = 60

async function owned(projectId: string, propertyId: string) {
  return db.seoProperty.findFirst({ where: { id: propertyId, projectId }, select: { id: true } })
}

// GET - the latest daily-monitor result for this site.
export const GET = withAuth(
  PERMISSIONS.PROJECT_READ,
  async (_req: NextRequest, ctx: { params: Record<string, string> }) => {
    const { id, propertyId } = ctx.params
    if (!(await owned(id!, propertyId!)))
      return NextResponse.json({ error: "Site not found" }, { status: 404 })
    return NextResponse.json({ data: await getLatestMonitor(propertyId!) })
  },
)

// POST - run the monitor check now (the daily cron does this automatically).
export const POST = withProjectManager(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _s: Session) => {
    const { id, propertyId } = ctx.params
    if (!(await owned(id!, propertyId!)))
      return NextResponse.json({ error: "Site not found" }, { status: 404 })
    const res = await runDailyMonitor(propertyId!)
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 })
    return NextResponse.json({ data: res })
  },
)
