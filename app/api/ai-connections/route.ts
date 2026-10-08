import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { listConnections } from "@/features/mcp/server/connections.service"

export const GET = withErrorHandler(async (req: NextRequest) =>
  respond(await listConnections(req.nextUrl.searchParams.get("scope") === "all" ? "all" : "mine")),
)
