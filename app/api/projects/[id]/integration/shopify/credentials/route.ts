import { NextRequest, NextResponse } from "next/server"
import { withProjectManager } from "@/features/projects/server/project-access"
import { getShopifyCredentials } from "@/features/projects/server/shopify-sync.service"
import type { Session } from "next-auth"

// Returns the DECRYPTED token for the edit form - manager-only, never on the member-facing route.
export const GET = withProjectManager(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const creds = await getShopifyCredentials(ctx.params.id)
      return NextResponse.json({ data: creds })
    } catch (error) {
      console.error("[PROJECT_SHOPIFY_CREDENTIALS]", error)
      return NextResponse.json({ error: "Failed to load credentials" }, { status: 500 })
    }
  },
)
