import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withProjectManager } from "@/features/projects/server/project-access"
import { backfillSeoProperty, syncSeoProperty } from "@/features/seo/server/seo.service"
import type { Session } from "next-auth"

export const runtime = "nodejs"
// A backfill is ~8 sequential Google round-trips; the default budget isn't enough.
export const maxDuration = 120

// POST - pull fresh Search Console data for ONE site.
//   { backfill: true } → also fetch the previous weeks so the trend line has
//                        history immediately (used right after setup).
export const POST = withProjectManager(
  async (req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    const { id: projectId, propertyId } = ctx.params
    const owned = await db.seoProperty.findFirst({
      where: { id: propertyId, projectId },
      select: { id: true },
    })
    if (!owned) return NextResponse.json({ error: "Site not found" }, { status: 404 })

    const body = await req.json().catch(() => ({}))

    if (body?.backfill) {
      const results = await backfillSeoProperty(propertyId!, 8)
      const failed = results.find((r) => !r.ok)
      if (failed && results.every((r) => !r.ok)) {
        return NextResponse.json({ error: failed.error }, { status: 502 })
      }
      return NextResponse.json({ data: { synced: results.filter((r) => r.ok).length, results } })
    }

    const result = await syncSeoProperty(propertyId!)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 })
    return NextResponse.json({ data: result })
  },
)
