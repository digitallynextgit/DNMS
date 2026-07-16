import { NextRequest, NextResponse } from "next/server"
import { withProjectManager } from "@/features/projects/server/project-access"
import { getMetaCredentials } from "@/features/projects/server/meta-sync.service"
import type { Session } from "next-auth"

// GET /api/projects/[id]/integration/credentials
// Returns the DECRYPTED Meta credentials to pre-fill the Edit form. Manager-only
// (withProjectManager) - never expose these on the member-facing dashboard route.
export const GET = withProjectManager(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const creds = await getMetaCredentials(ctx.params.id)
      return NextResponse.json({ data: creds })
    } catch (error) {
      console.error("[PROJECT_INTEGRATION_CREDENTIALS]", error)
      return NextResponse.json({ error: "Failed to load credentials" }, { status: 500 })
    }
  },
)
