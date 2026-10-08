import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/server/api-handler"
import { gscServiceAccountEmail, isGscConfigured, listGscSites } from "@/lib/gsc"
import { PERMISSIONS } from "@/lib/constants"

// Search Console properties the service account can read, so people pick the exact id.
export const GET = withAuth(
  PERMISSIONS.PROJECT_WRITE,
  async (_req: NextRequest, _ctx: { params: Record<string, string> }) => {
    if (!(await isGscConfigured())) {
      return NextResponse.json(
        { error: "Search Console credentials are not configured", data: { sites: [] } },
        { status: 503 },
      )
    }
    try {
      const [sites, serviceAccount] = await Promise.all([listGscSites(), gscServiceAccountEmail()])
      return NextResponse.json({ data: { sites, serviceAccount } })
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Could not list properties" },
        { status: 502 },
      )
    }
  },
)
