import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import { getStorageOverview } from "@/features/storage/server/storage.service"
import type { Session } from "next-auth"

// GET /api/admin/storage - full bucket overview (usage, breakdown, files).
// Gated on settings:write (same as the Integrations page where B2 is configured).
export const GET = withAuth(
  PERMISSIONS.SETTINGS_WRITE,
  async (_req: NextRequest, _ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      return NextResponse.json({ data: await getStorageOverview() })
    } catch (error) {
      console.error("[ADMIN_STORAGE_GET]", error)
      return NextResponse.json({ error: "Failed to read storage" }, { status: 500 })
    }
  },
)
