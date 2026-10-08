import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { updateLeaveType, deleteLeaveType } from "@/features/leave/server/leave.service"

export const PATCH = withErrorHandler(async (req: NextRequest, ctx: { params: { id: string } }) => {
  const { id } = ctx.params
  const body = (await req.json()) as Record<string, unknown>
  return respond(await updateLeaveType(id, body))
})

export const DELETE = withErrorHandler(
  async (req: NextRequest, ctx: { params: { id: string } }) => {
    const { id } = ctx.params
    const permanent = req.nextUrl.searchParams.get("permanent") === "1"
    return respond(await deleteLeaveType(id, permanent))
  },
)
