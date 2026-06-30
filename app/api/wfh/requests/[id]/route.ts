import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { updateWfhRequest } from "@/features/wfh/server/wfh.service"

// PATCH /api/wfh/requests/[id] - cancel / approve / reject a WFH request. The
// server decides whether the actor is the advisory manager or final HR.
export const PATCH = withErrorHandler(async (req: NextRequest, ctx: { params: { id: string } }) => {
  const { id } = ctx.params
  const body = (await req.json()) as {
    action: "CANCEL" | "APPROVE" | "REJECT"
    rejectionReason?: string
  }
  return respond(await updateWfhRequest(id, body.action, body.rejectionReason))
})
