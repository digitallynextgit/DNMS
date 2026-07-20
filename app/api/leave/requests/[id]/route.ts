import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { updateLeaveRequest } from "@/features/leave/server/leave.service"

// PATCH /api/leave/requests/[id] - cancel / approve / reject a leave request.
export const PATCH = withErrorHandler(async (req: NextRequest, ctx: { params: { id: string } }) => {
  const { id } = ctx.params
  const body = (await req.json()) as {
    action: "CANCEL" | "APPROVE" | "REJECT"
    rejectionReason?: string
    emailBody?: string
  }
  return respond(await updateLeaveRequest(id, body.action, body.rejectionReason, body.emailBody))
})
