import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { updateLeaveType, deleteLeaveType } from "@/features/leave/server/leave.service"

// PATCH /api/leave/types/[id] - update a leave type.
export const PATCH = withErrorHandler(async (req: NextRequest, ctx: { params: { id: string } }) => {
  const { id } = ctx.params
  const body = (await req.json()) as Record<string, unknown>
  return respond(await updateLeaveType(id, body))
})

// DELETE /api/leave/types/[id] - deactivate a leave type, or permanently delete
// it with ?permanent=1.
export const DELETE = withErrorHandler(
  async (req: NextRequest, ctx: { params: { id: string } }) => {
    const { id } = ctx.params
    const permanent = req.nextUrl.searchParams.get("permanent") === "1"
    return respond(await deleteLeaveType(id, permanent))
  },
)
