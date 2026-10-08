import { NextRequest } from "next/server"
import { revokeToken } from "@/features/mcp/server/oauth.service"
import { oauthJson, preflight, readForm } from "@/features/mcp/server/http"

// RFC 7009: revoking either token disconnects the whole connection. Always 200, so it reveals nothing.

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
