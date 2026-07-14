import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import { getDashboardStats } from "@/features/dashboard/server/dashboard.queries"

// Org-wide HR stats. The query lives in features/dashboard/server/dashboard.queries.ts
// so the dashboard page can prefetch it server-side without an HTTP hop.
export const GET = withAuth(
  PERMISSIONS.DASHBOARD_READ,
  async (_req: NextRequest, _context: { params: Record<string, string> }) => {
    return NextResponse.json(await getDashboardStats())
  },
)
