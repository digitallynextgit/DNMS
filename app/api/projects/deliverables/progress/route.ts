import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withSession } from "@/server/api-handler"
import {
  loadDeliverablesProgress,
  narrowPick,
  resolveReportScope,
} from "@/features/projects/server/deliverables-report"

// GET /api/projects/deliverables/progress?from&to&projectIds&teamIds&employeeIds
//
// The numbers behind the "My Progress" page. Same scope rules and the same
// arithmetic as the slide deck, so the page and the slides always agree.
// Leaving from/to out means "all time"; the id lists are comma-separated and
// must sit inside what the caller is allowed to see.
export const dynamic = "force-dynamic"

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const ALL_TIME_FROM = "2000-01-01"
const ALL_TIME_TO = "2099-12-31"

const ids = (raw: string | null): string[] =>
  raw
    ? raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : []

export const GET = withSession(
  async (req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    const q = req.nextUrl.searchParams
    const from = q.get("from") || ALL_TIME_FROM
    const to = q.get("to") || ALL_TIME_TO
    if (!DAY_RE.test(from) || !DAY_RE.test(to)) {
      return NextResponse.json({ error: "from and to must be YYYY-MM-DD" }, { status: 400 })
    }
    if (to < from) {
      return NextResponse.json({ error: "to must be on or after from" }, { status: 400 })
    }

    try {
      const scope = await resolveReportScope(session)
      const pick = narrowPick(scope, {
        projectIds: ids(q.get("projectIds")),
        teamIds: ids(q.get("teamIds")),
        employeeIds: ids(q.get("employeeIds")),
      })
      if (!pick) {
        return NextResponse.json(
          { error: "That project, team or person is outside what you can see" },
          { status: 403 },
        )
      }
      const data = await loadDeliverablesProgress({ scope, pick, from, to })
      return NextResponse.json({ data })
    } catch (error) {
      console.error("[deliverables/progress]", error)
      return NextResponse.json({ error: "Could not load deliverables progress" }, { status: 500 })
    }
  },
)
