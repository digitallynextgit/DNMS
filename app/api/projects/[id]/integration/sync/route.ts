import { NextRequest, NextResponse } from "next/server"
import { withProjectManager } from "@/features/projects/server/project-access"
import { syncMetaProject } from "@/features/projects/server/meta-sync.service"
import type { Session } from "next-auth"

// POST /api/projects/[id]/integration/sync - pull latest Meta data (managers).
// Optional body { lookbackDays } (default 30).
export const POST = withProjectManager(
  async (req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const body = (await req.json().catch(() => ({}))) as { lookbackDays?: number }
      const days = Math.min(90, Math.max(1, Number(body.lookbackDays) || 30))
      const r = await syncMetaProject(ctx.params.id, days)
      return NextResponse.json({
        data: { ...r, message: `Synced ${r.records} day-rows across ${r.campaigns} campaigns.` },
      })
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Sync failed"
      console.error("[PROJECT_INTEGRATION_SYNC]", error)
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  },
)
