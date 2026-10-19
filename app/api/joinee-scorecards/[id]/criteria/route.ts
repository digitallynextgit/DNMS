import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { updateCardCriteria } from "@/features/joinee-scorecard/server/scorecard.service"

// One joinee's criteria only; the company default is /api/joinee-scorecards/criteria.
export const PUT = withErrorHandler(async (req: NextRequest, ctx: { params: { id: string } }) => {
  const body = (await req.json()) as { items?: unknown }
  return respond(await updateCardCriteria(ctx.params.id, body))
})
