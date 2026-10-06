import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { updateScorecardDay } from "@/features/joinee-scorecard/server/scorecard.service"

// PATCH /api/joinee-scorecards/[id]/days/[day] { mgrJobRole?: 1-5|null, ... } - one day's scores.
export const PATCH = withErrorHandler(
  async (req: NextRequest, ctx: { params: { id: string; day: string } }) => {
    const body = (await req.json()) as Record<string, unknown>
    return respond(await updateScorecardDay(ctx.params.id, Number(ctx.params.day), body))
  },
)
