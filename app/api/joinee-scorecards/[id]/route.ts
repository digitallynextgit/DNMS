import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import {
  updateScorecard,
  deleteScorecard,
} from "@/features/joinee-scorecard/server/scorecard.service"

// PATCH /api/joinee-scorecards/[id] { hrSpocId?, managerObservations?, hrObservations?, recommendation? }
export const PATCH = withErrorHandler(async (req: NextRequest, ctx: { params: { id: string } }) => {
  const body = (await req.json()) as {
    hrSpocId?: string | null
    managerObservations?: string | null
    hrObservations?: string | null
    recommendation?: string | null
  }
  return respond(await updateScorecard(ctx.params.id, body))
})

// DELETE /api/joinee-scorecards/[id] - throw the scorecard away (onboarding:write).
export const DELETE = withErrorHandler(async (_req: NextRequest, ctx: { params: { id: string } }) =>
  respond(await deleteScorecard(ctx.params.id)),
)
