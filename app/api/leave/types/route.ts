import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { getLeaveTypes, createLeaveType } from "@/features/leave/server/leave.service"

// GET /api/leave/types - active leave types.
export const GET = withErrorHandler(async () => respond(await getLeaveTypes()))

// POST /api/leave/types - create a leave type.
export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = (await req.json()) as Record<string, unknown>
  return respond(await createLeaveType(body))
})
