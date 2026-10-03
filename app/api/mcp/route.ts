import { requireBearerAuth } from "@modelcontextprotocol/server"
import { mcpHttpHandler } from "@/features/mcp/server/mcp-server"
import { tokenVerifier } from "@/features/mcp/server/principal"
import { resourceMetadataUrl } from "@/features/mcp/server/config"
import { preflight, withCors } from "@/features/mcp/server/http"

// The DNMS MCP server - what Claude, ChatGPT and other AI apps connect to.
// Routing glue only: tools live in features/mcp/server/mcp-server.ts, token
// checks in features/mcp/server/principal.ts. Speaks MCP (JSON-RPC), not the
// app's { success, data } envelope.
//
// No token / bad token → 401 with WWW-Authenticate pointing at our Protected
// Resource Metadata, which is how the AI app discovers the DNMS login.
// proxy.ts lists /api/mcp in PUBLIC_PREFIXES so that 401 comes from here, not
// from the session guard.

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
