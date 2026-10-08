import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withSession } from "@/server/api-handler"
import {
  describeWorkReportScope,
  resolveWorkReportScope,
} from "@/features/work-reports/server/work-report.scope"

// Same resolver as the download, so the page never offers someone the route would refuse.
export const dynamic = "force-dynamic"

export const GET = withSession(
  async (_req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    const data = await describeWorkReportScope(await resolveWorkReportScope(session))
    return NextResponse.json({ data })
  },
)
