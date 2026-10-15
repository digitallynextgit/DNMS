import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import {
  getScorecardCriteria,
  updateScorecardCriteria,
} from "@/features/joinee-scorecard/server/scorecard.service"

export const GET = withErrorHandler(async () => respond(await getScorecardCriteria()))

export const PUT = withErrorHandler(async (req: NextRequest) => {
  const body = (await req.json()) as { items?: unknown }
  return respond(await updateScorecardCriteria(body))
})
