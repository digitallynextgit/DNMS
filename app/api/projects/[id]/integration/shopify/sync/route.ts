import { NextRequest, NextResponse } from "next/server"
import { withProjectManager } from "@/features/projects/server/project-access"
import { syncShopifyProject } from "@/features/projects/server/shopify-sync.service"
import type { Session } from "next-auth"

export const maxDuration = 300

export const POST = withProjectManager(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const r = await syncShopifyProject(ctx.params.id)
      return NextResponse.json({
        data: {
          ...r,
          message: `Synced ${r.orders} orders from the last ${r.historyDays} days and ${r.products} products.`,
        },
      })
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Sync failed"
      console.error("[PROJECT_SHOPIFY_SYNC]", error)
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  },
)
