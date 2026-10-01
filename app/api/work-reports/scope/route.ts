import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withSession } from "@/server/api-handler"
import {
  describeWorkReportScope,
  resolveWorkReportScope,
} from "@/features/work-reports/server/work-report.scope"

// GET /api/work-reports/scope
//
// The people the caller may put in a work report, from the same resolver the
// download uses - so the page can never offer someone the route would refuse.
export const dynamic = "force-dynamic"

export const GET = withSession(
  async (_req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    const data = await describeWorkReportScope(await resolveWorkReportScope(session))
    return NextResponse.json({ data })
  },
)
