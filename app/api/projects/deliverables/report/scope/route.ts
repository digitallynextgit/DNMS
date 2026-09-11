import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withSession } from "@/server/api-handler"
import {
  describeReportScope,
  resolveReportScope,
} from "@/features/projects/server/deliverables-report"

// GET /api/projects/deliverables/report/scope
//
// The pickers for the slide-deck dialog: the caller's role and every project,
// team and person they are allowed to put in a report. Computed from the same
// scope resolver the download uses, so the dialog can never offer something
// the route would then refuse.
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
