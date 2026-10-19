import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import {
  getDefaultReviewParams,
  updateDefaultReviewParams,
} from "@/features/joinee-scorecard/server/weekly-review.service"

export const GET = withErrorHandler(async () => respond(await getDefaultReviewParams()))

export const PUT = withErrorHandler(async (req: NextRequest) => {
  const body = (await req.json()) as { items?: unknown }
  return respond(await updateDefaultReviewParams(body))
})
