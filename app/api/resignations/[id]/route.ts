import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { cancelResignation } from "@/features/resignations/server/resignations.service"

export const DELETE = withErrorHandler(
  async (_req: NextRequest, ctx: { params: { id: string } }) => {
    const { id } = ctx.params
    return respond(await cancelResignation(id))
  },
)
