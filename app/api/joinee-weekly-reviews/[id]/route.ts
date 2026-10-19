import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { deleteWeeklyReview } from "@/features/joinee-scorecard/server/weekly-review.service"

export const DELETE = withErrorHandler(async (_req: NextRequest, ctx: { params: { id: string } }) =>
  respond(await deleteWeeklyReview(ctx.params.id)),
)
