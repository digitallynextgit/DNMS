import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { getColleagueProfile } from "@/features/employees/server/employees.service"

// GET /api/employees/[id]/card
//
// The colleague-visible subset, for any signed-in employee. The sibling route
// one level up is the full HR record and stays gated behind employee:read.
export const GET = withErrorHandler(async (_req: NextRequest, ctx: { params: { id: string } }) =>
  respond(await getColleagueProfile(ctx.params.id)),
)
