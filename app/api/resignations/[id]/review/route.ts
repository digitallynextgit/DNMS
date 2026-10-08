import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { reviewResignation } from "@/features/resignations/server/resignations.service"

export const POST = withErrorHandler(async (req: NextRequest, ctx: { params: { id: string } }) => {
  const { id } = ctx.params
  const body = (await req.json()) as { action: "APPROVE" | "REJECT"; note?: string }
  return respond(await reviewResignation(id, body.action, body.note))
})
