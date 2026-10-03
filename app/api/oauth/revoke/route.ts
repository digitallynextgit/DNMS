import { NextRequest } from "next/server"
import { revokeToken } from "@/features/mcp/server/oauth.service"
import { oauthJson, preflight, readForm } from "@/features/mcp/server/http"

// POST /api/oauth/revoke - token revocation (RFC 7009). Revoking either token
// disconnects the whole connection. Always 200, as the RFC requires, so it
// reveals nothing about whether the token existed.

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    await revokeToken(await readForm(req))
  } catch (err) {
    console.error("[oauth/revoke]", err)
  }
  return oauthJson({})
}

export const OPTIONS = preflight
