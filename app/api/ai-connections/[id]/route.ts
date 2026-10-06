import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { revokeConnection } from "@/features/mcp/server/connections.service"

// DELETE /api/ai-connections/[id] - disconnect an AI app (revokes every token
// it holds immediately). Own connections for anyone; others need role:write.
export const DELETE = withErrorHandler(async (_req: NextRequest, ctx: { params: { id: string } }) =>
  respond(await revokeConnection(ctx.params.id)),
)
