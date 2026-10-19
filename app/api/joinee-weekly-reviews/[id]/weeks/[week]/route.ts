import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { updateWeeklyReviewWeek } from "@/features/joinee-scorecard/server/weekly-review.service"

export const PATCH = withErrorHandler(
  async (req: NextRequest, ctx: { params: { id: string; week: string } }) => {
    const body = (await req.json()) as { scores?: unknown; comment?: unknown }
    return respond(await updateWeeklyReviewWeek(ctx.params.id, Number(ctx.params.week), body))
  },
)
