import { NextRequest } from "next/server"
import { OAuthFlowError, exchangeCode, refreshTokens } from "@/features/mcp/server/oauth.service"
import { oauthError, oauthJson, preflight, readForm } from "@/features/mcp/server/http"
import { clientIp, rateLimited } from "@/lib/rate-limit"

// POST /api/oauth/token - OAuth 2.1 token endpoint (AI connector).
// grant_type=authorization_code (+ PKCE code_verifier) or refresh_token.
// Public clients only; RFC 6749 error codes, which Claude/ChatGPT rely on
// (an invalid refresh token MUST be `invalid_grant` so they re-authorize).

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  if (rateLimited(`oauth:token:${clientIp(req)}`, 120, 60_000)) {
    return oauthError("slow_down", "Too many token requests", 429)
  }
  const form = await readForm(req)
  try {
    switch (form.get("grant_type")) {
      case "authorization_code":
        return oauthJson(await exchangeCode(form))
      case "refresh_token":
        return oauthJson(await refreshTokens(form))
      default:
        return oauthError(
          "unsupported_grant_type",
          "Only authorization_code and refresh_token are supported",
        )
    }
  } catch (err) {
    if (err instanceof OAuthFlowError) return oauthError(err.error, err.message, err.status)
    console.error("[oauth/token]", err)
    return oauthError("server_error", "Token request failed", 500)
  }
}

export const OPTIONS = preflight
