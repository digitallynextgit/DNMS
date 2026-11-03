import { NextRequest, NextResponse } from "next/server"
import { withProjectAccess, withProjectManager } from "@/features/projects/server/project-access"
import {
  getShopifyDashboard,
  saveShopifyIntegration,
  disconnectShopify,
} from "@/features/projects/server/shopify-sync.service"
import type { Session } from "next-auth"

export const GET = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      // ?days=30 or ?from=&to= (inclusive days). Anything not yyyy-MM-dd is ignored by the service.
      const params = req.nextUrl.searchParams
      const daysParam = params.get("days")
      const days = daysParam ? Math.min(1100, Math.max(1, Number(daysParam))) : undefined
      const from = params.get("from") ?? undefined
      const to = params.get("to") ?? undefined
      return NextResponse.json({
        data: await getShopifyDashboard(ctx.params.id, { days, from, to }),
      })
    } catch (error) {
      console.error("[PROJECT_SHOPIFY_GET]", error)
      return NextResponse.json({ error: "Failed to load Shopify" }, { status: 500 })
    }
  },
)

export const POST = withProjectManager(
  async (req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const body = (await req.json()) as { storeDomain?: string; accessToken?: string }
      // A blank access token while editing means "keep the stored one" (the service resolves it).
      if (!body.storeDomain?.trim()) {
        return NextResponse.json({ error: "Store address is required" }, { status: 400 })
      }
      const r = await saveShopifyIntegration(ctx.params.id, {
        storeDomain: body.storeDomain,
        accessToken: body.accessToken ?? "",
      })
      if (!r.ok)
        return NextResponse.json({ error: r.error ?? "Could not connect" }, { status: 400 })
      // Says how much history the token reaches, so a missing read_all_orders shows at once.
      const message =
        r.historyDays && r.historyDays > 60
          ? `Shopify connected, with ${r.historyDays} days of order history.`
          : "Shopify connected, with the last 60 days of orders. Give the app read_all_orders for 3 years."
      return NextResponse.json({ data: { message } })
    } catch (error) {
      console.error("[PROJECT_SHOPIFY_POST]", error)
      return NextResponse.json({ error: "Failed to save Shopify" }, { status: 500 })
    }
  },
)

export const DELETE = withProjectManager(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      await disconnectShopify(ctx.params.id)
      return NextResponse.json({ data: { message: "Disconnected." } })
    } catch (error) {
      console.error("[PROJECT_SHOPIFY_DELETE]", error)
      return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 })
    }
  },
)
