import { NextRequest } from "next/server"
import { withSession, respond } from "@/server/api-handler"
import { ok } from "@/server/action-result"
import { listFloatingDecisions } from "@/features/attendance/server/floating-decisions.queries"

// ?year=YYYY (default this year): every floating-holiday request with its outcome, for the board.
export const GET = withSession(async (req: NextRequest, _ctx, session) => {
  const year = Number(req.nextUrl.searchParams.get("year")) || new Date().getUTCFullYear()
  return respond(ok(await listFloatingDecisions(session, year)))
})
