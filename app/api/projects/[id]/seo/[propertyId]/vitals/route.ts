import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { withProjectManager } from "@/features/projects/server/project-access"
import { runVitalsCheck, runTrafficSync } from "@/features/seo/server/seo.vitals.service"
import { PERMISSIONS } from "@/lib/constants"
import type { Session } from "next-auth"

export const runtime = "nodejs"
// A PSI call is a real Lighthouse run - up to ~30s each, run sequentially.
export const maxDuration = 300

async function owned(projectId: string, propertyId: string) {
  return db.seoProperty.findFirst({ where: { id: propertyId, projectId }, select: { id: true } })
}

// GET - the latest Core Web Vitals reading per URL.
export const GET = withAuth(
  PERMISSIONS.PROJECT_READ,
  async (_req: NextRequest, ctx: { params: Record<string, string> }) => {
    const { id, propertyId } = ctx.params
    if (!(await owned(id!, propertyId!)))
      return NextResponse.json({ error: "Site not found" }, { status: 404 })

    const rows = await db.seoVitals.findMany({
      where: { propertyId },
      orderBy: { checkedAt: "desc" },
      take: 60,
    })
    // Latest row per URL - the table shows current state, not history.
    const seen = new Set<string>()
    const latest = rows.filter((r) => !seen.has(r.url) && seen.add(r.url))
    return NextResponse.json({ data: latest })
  },
)

// POST - measure now. { traffic: true } also pulls GA4 for the same window.
export const POST = withProjectManager(
  async (req: NextRequest, ctx: { params: Record<string, string> }, _s: Session) => {
    const { id, propertyId } = ctx.params
    if (!(await owned(id!, propertyId!)))
      return NextResponse.json({ error: "Site not found" }, { status: 404 })

    const body = await req.json().catch(() => ({}))
    const vitals = await runVitalsCheck(propertyId!)
    const traffic = body?.traffic ? await runTrafficSync(propertyId!) : null
    return NextResponse.json({ data: { vitals, traffic } })
  },
)
