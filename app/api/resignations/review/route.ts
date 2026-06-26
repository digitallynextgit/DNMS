import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { getResignationsToReview } from "@/features/resignations/server/resignations.service"

type ReviewFilters = {
  page?: number
  limit?: number
}

// GET /api/resignations/review - resignations the current user may act on (paginated).
export const GET = withErrorHandler(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams
  const filters: ReviewFilters = {}
  if (sp.has("page")) filters.page = Number(sp.get("page"))
  if (sp.has("limit")) filters.limit = Number(sp.get("limit"))
  return respond(await getResignationsToReview(filters))
})
