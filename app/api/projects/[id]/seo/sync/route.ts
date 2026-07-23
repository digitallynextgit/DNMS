import { NextRequest, NextResponse } from "next/server"
import { withProjectManager } from "@/features/projects/server/project-access"
import { syncProjectSeo } from "@/features/seo/server/seo.service"
import type { Session } from "next-auth"

export const runtime = "nodejs"
// One Google round-trip set per site; an account like KYG has 13 of them.
export const maxDuration = 300

// POST - sync every active site on this project ("Sync all").
export const POST = withProjectManager(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    const results = await syncProjectSeo(ctx.params.id!)
    if (results.length === 0) {
      return NextResponse.json({ error: "No sites are set up yet" }, { status: 404 })
    }
    const synced = results.filter((r) => r.ok).length
    // All-failed is a real error (bad credentials, API disabled); a partial
    // failure still succeeds so the sites that worked show fresh data.
    if (synced === 0) {
      return NextResponse.json({ error: results[0]!.error ?? "Sync failed" }, { status: 502 })
    }
    return NextResponse.json({
      data: { synced, failed: results.length - synced, results },
    })
  },
)
