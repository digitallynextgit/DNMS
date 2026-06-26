import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { updateLeaveType, deleteLeaveType } from "@/features/leave/server/leave.service"

// PATCH /api/leave/types/[id] - update a leave type.
export const PATCH = withErrorHandler(async (req: NextRequest, ctx: { params: { id: string } }) => {
  const { id } = ctx.params
  const body = (await req.json()) as Record<string, unknown>
  return respond(await updateLeaveType(id, body))
})

// DELETE /api/leave/types/[id] - deactivate a leave type.
export const DELETE = withErrorHandler(
  async (_req: NextRequest, ctx: { params: { id: string } }) => {
    const { id } = ctx.params
    return respond(await deleteLeaveType(id))
  },
)
