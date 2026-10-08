import { NextRequest } from "next/server"
import { ClientError, registerDynamicClient } from "@/features/mcp/server/clients.service"
import { oauthError, oauthJson, preflight } from "@/features/mcp/server/http"
import { clientIp, rateLimited } from "@/lib/rate-limit"

// RFC 7591 registration: deprecated by MCP in favour of CIMD, kept for older agents. It grants nothing -
// a person must still log in and allow, and redirect URIs must be on the allowlist.

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  if (rateLimited(`oauth:register:${clientIp(req)}`, 20, 60 * 60_000)) {
    return oauthError("slow_down", "Too many registrations", 429)
  }
  const body = await req.json().catch(() => null)
  try {
    return oauthJson(await registerDynamicClient(body), 201)
  } catch (err) {
    if (err instanceof ClientError) return oauthError(err.code, err.message)
    console.error("[oauth/register]", err)
    return oauthError("server_error", "Registration failed", 500)
  }
}

export const OPTIONS = preflight
