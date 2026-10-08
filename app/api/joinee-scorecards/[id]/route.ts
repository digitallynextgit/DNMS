import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import {
  updateScorecard,
  deleteScorecard,
} from "@/features/joinee-scorecard/server/scorecard.service"

export const PATCH = withErrorHandler(async (req: NextRequest, ctx: { params: { id: string } }) => {
  const body = (await req.json()) as {
    hrSpocId?: string | null
    managerObservations?: string | null
    hrObservations?: string | null
    recommendation?: string | null
  }
  return respond(await updateScorecard(ctx.params.id, body))
})

export const DELETE = withErrorHandler(async (_req: NextRequest, ctx: { params: { id: string } }) =>
  respond(await deleteScorecard(ctx.params.id)),
)
