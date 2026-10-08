import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { getScorecard, createScorecard } from "@/features/joinee-scorecard/server/scorecard.service"

export const GET = withErrorHandler(async (req: NextRequest) =>
  respond(await getScorecard(req.nextUrl.searchParams.get("employeeId") ?? "")),
)

export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = (await req.json()) as { employeeId?: string; hrSpocId?: string | null }
  return respond(await createScorecard(body), 201)
})
