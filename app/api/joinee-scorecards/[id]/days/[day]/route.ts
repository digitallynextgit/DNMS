import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { updateScorecardDay } from "@/features/joinee-scorecard/server/scorecard.service"

export const PATCH = withErrorHandler(
  async (req: NextRequest, ctx: { params: { id: string; day: string } }) => {
    const body = (await req.json()) as Record<string, unknown>
    return respond(await updateScorecardDay(ctx.params.id, Number(ctx.params.day), body))
  },
)
