import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withSession } from "@/server/api-handler"
import {
  buildDeliverablesDeck,
  narrowPick,
  resolveReportScope,
} from "@/features/projects/server/deliverables-report"

// GET /api/projects/deliverables/report?from&to&projectIds&teamIds&employeeIds&ai
//
// The deliverables slide deck as a .pptx download. Scope is resolved from the
// session (admin / account manager / team manager / member) and the query can
// only narrow it - asking for a team you do not run is a 403, not an empty deck.
//
// `from` and `to` are REQUIRED and capped at a year, the same rule as the CSV
// export: every other filter is optional, so a bare call would otherwise mean
// "every deliverable ever" rendered into one file.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_RANGE_DAYS = 366
const MS_PER_DAY = 86_400_000
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation"

const ids = (raw: string | null): string[] =>
  raw
    ? raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 200)
    : []

export const GET = withSession(
  async (req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    const q = req.nextUrl.searchParams
    const from = q.get("from")
    const to = q.get("to")
    if (!from || !to || !DAY_RE.test(from) || !DAY_RE.test(to)) {
      return NextResponse.json({ error: "from and to (YYYY-MM-DD) are required" }, { status: 400 })
    }
    const span = (Date.parse(to) - Date.parse(from)) / MS_PER_DAY
    if (Number.isNaN(span) || span < 0) {
      return NextResponse.json({ error: "to must be on or after from" }, { status: 400 })
    }
    if (span > MAX_RANGE_DAYS) {
      return NextResponse.json({ error: "The window can be at most a year" }, { status: 400 })
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
          { error: "That scope is outside what you can report on" },
          { status: 403 },
        )
      }

      const deck = await buildDeliverablesDeck({
        session,
        scope,
        pick,
        from,
        to,
        ai: q.get("ai") !== "0",
      })
      return new NextResponse(deck.bytes, {
        status: 200,
        headers: {
          "Content-Type": PPTX,
          "Content-Disposition": `attachment; filename="${deck.filename}"`,
          "Cache-Control": "no-store",
        },
      })
    } catch (error) {
      console.error("[deliverables/report]", error)
      return NextResponse.json({ error: "Could not build the slides" }, { status: 500 })
    }
  },
)
