import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { revokeConnection } from "@/features/mcp/server/connections.service"

export const DELETE = withErrorHandler(async (_req: NextRequest, ctx: { params: { id: string } }) =>
  respond(await revokeConnection(ctx.params.id)),
)
