import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { getColleagueProfile } from "@/features/employees/server/employees.service"

// The colleague-visible subset, for any employee; the full HR record needs employee:read.
export const GET = withErrorHandler(async (_req: NextRequest, ctx: { params: { id: string } }) =>
  respond(await getColleagueProfile(ctx.params.id)),
)
