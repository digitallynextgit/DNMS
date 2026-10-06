import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { getScorecard, createScorecard } from "@/features/joinee-scorecard/server/scorecard.service"

// GET /api/joinee-scorecards?employeeId= - that employee's 15-day scorecard (or
// null) plus canEdit. The employee themself, or onboarding:read/write.
export const GET = withErrorHandler(async (req: NextRequest) =>
  respond(await getScorecard(req.nextUrl.searchParams.get("employeeId") ?? "")),
)

// POST /api/joinee-scorecards { employeeId, hrSpocId? } - start one by hand (onboarding:write).
export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = (await req.json()) as { employeeId?: string; hrSpocId?: string | null }
  return respond(await createScorecard(body), 201)
})
