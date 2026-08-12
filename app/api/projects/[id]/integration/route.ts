import { NextRequest, NextResponse } from "next/server"
import { withProjectAccess, withProjectManager } from "@/features/projects/server/project-access"
import {
  getMetaDashboard,
  saveMetaIntegration,
  disconnectMetaIntegration,
} from "@/features/projects/server/meta-sync.service"
import type { Session } from "next-auth"

// GET /api/projects/[id]/integration - integration status + Meta dashboard data.
export const GET = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      // Either a rolling window (?days=30) or an explicit span (?from=&to=).
      // The service treats from/to as inclusive days and ignores anything that
      // is not a yyyy-MM-dd, so a hand-edited URL widens the range at worst.
      const params = req.nextUrl.searchParams
      const daysParam = params.get("days")
      const days = daysParam ? Math.min(365, Math.max(1, Number(daysParam))) : undefined
      const from = params.get("from") ?? undefined
      const to = params.get("to") ?? undefined
      return NextResponse.json({ data: await getMetaDashboard(ctx.params.id, { days, from, to }) })
    } catch (error) {
      console.error("[PROJECT_INTEGRATION_GET]", error)
      return NextResponse.json({ error: "Failed to load integration" }, { status: 500 })
    }
  },
)

// POST /api/projects/[id]/integration - connect/update Meta credentials (managers).
export const POST = withProjectManager(
  async (req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const body = (await req.json()) as {
        appId?: string
        appSecret?: string
        accessToken?: string
        adAccountId?: string
      }
      // Ad Account ID is always required; the access token may be blank when EDITING
      // (blank = keep the stored token) - the service resolves + validates that.
      if (!body.adAccountId?.trim()) {
        return NextResponse.json({ error: "Ad Account ID is required" }, { status: 400 })
      }
      const r = await saveMetaIntegration(ctx.params.id, {
        appId: body.appId ?? "",
        appSecret: body.appSecret ?? "",
        accessToken: body.accessToken ?? "",
        adAccountId: body.adAccountId,
      })
      if (!r.ok)
        return NextResponse.json({ error: r.error ?? "Could not connect" }, { status: 400 })
      return NextResponse.json({ data: { message: "Meta Ads connected." } })
    } catch (error) {
      console.error("[PROJECT_INTEGRATION_POST]", error)
      return NextResponse.json({ error: "Failed to save integration" }, { status: 500 })
    }
  },
)

// DELETE /api/projects/[id]/integration - disconnect + remove synced data (managers).
export const DELETE = withProjectManager(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      await disconnectMetaIntegration(ctx.params.id)
      return NextResponse.json({ data: { message: "Disconnected." } })
    } catch (error) {
      console.error("[PROJECT_INTEGRATION_DELETE]", error)
      return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 })
    }
  },
)
