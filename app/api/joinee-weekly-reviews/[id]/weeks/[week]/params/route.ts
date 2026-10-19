import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { updateWeekParams } from "@/features/joinee-scorecard/server/weekly-review.service"

// One Friday's parameters for one joinee; the company default is /api/joinee-weekly-reviews/params.
export const PUT = withErrorHandler(
  async (req: NextRequest, ctx: { params: { id: string; week: string } }) => {
    const body = (await req.json()) as { items?: unknown }
    return respond(await updateWeekParams(ctx.params.id, Number(ctx.params.week), body))
  },
)
