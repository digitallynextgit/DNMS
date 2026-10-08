import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withSession } from "@/server/api-handler"
import {
  describeReportScope,
  resolveReportScope,
} from "@/features/projects/server/deliverables-report"

// Uses the same scope resolver as the download, so the dialog never offers what the route would refuse.
export const dynamic = "force-dynamic"

export const GET = withSession(
  async (_req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const scope = await resolveReportScope(session)
      const data = await describeReportScope(scope)
      return NextResponse.json({ data })
    } catch (error) {
      console.error("[deliverables/report/scope]", error)
      return NextResponse.json({ error: "Could not load the report scope" }, { status: 500 })
    }
  },
)
