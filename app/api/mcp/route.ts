import { requireBearerAuth } from "@modelcontextprotocol/server"
import { mcpHttpHandler } from "@/features/mcp/server/mcp-server"
import { tokenVerifier } from "@/features/mcp/server/principal"
import { resourceMetadataUrl } from "@/features/mcp/server/config"
import { preflight, withCors } from "@/features/mcp/server/http"

// Speaks MCP (JSON-RPC), not the { success, data } envelope. The 401's WWW-Authenticate header is how
// AI apps discover the login (proxy.ts lets /api/mcp through).

export const dynamic = "force-dynamic"
// Some DNMS endpoints (exports, analytics) are slow; give the AI the same room.
export const maxDuration = 120

const gate = requireBearerAuth({
  verifier: tokenVerifier,
  // Built from APP_PUBLIC_ORIGIN, never from the request (nginx).
  resourceMetadataUrl: resourceMetadataUrl(),
})

async function handler(req: Request) {
  const auth = await gate(req)
  if (auth instanceof Response) return withCors(auth)
  return withCors(await mcpHttpHandler.fetch(req, { authInfo: auth }))
}

export { handler as GET, handler as POST, handler as DELETE }
export const OPTIONS = preflight
