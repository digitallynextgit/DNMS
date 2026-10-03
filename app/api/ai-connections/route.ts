import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { listConnections } from "@/features/mcp/server/connections.service"

// GET /api/ai-connections?scope=mine|all - AI apps connected to DNMS via MCP.
// "mine" for everyone; "all" needs role:write (checked in the service).
export const GET = withErrorHandler(async (req: NextRequest) =>
  respond(await listConnections(req.nextUrl.searchParams.get("scope") === "all" ? "all" : "mine")),
)
