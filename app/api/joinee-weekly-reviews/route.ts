import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import {
  createWeeklyReview,
  getWeeklyReview,
} from "@/features/joinee-scorecard/server/weekly-review.service"

export const GET = withErrorHandler(async (req: NextRequest) =>
  respond(await getWeeklyReview(req.nextUrl.searchParams.get("employeeId") ?? "")),
)

export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = (await req.json()) as { employeeId?: string }
  return respond(await createWeeklyReview(body), 201)
})
