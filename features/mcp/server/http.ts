import "server-only"

import { NextResponse } from "next/server"
import { DEFAULT_SCOPES, SUPPORTED_SCOPES } from "../constants"
import { issuer, mcpResource, oauthEndpoints, publicOrigin } from "./config"

// =============================================================================
// Wire-format helpers for the OAuth + MCP endpoints.
//
// These endpoints speak OAuth (RFC 6749/8414/9728/7591/7009) and MCP, not the
// app's { success, data } envelope - a deliberate exception to CLAUDE.md §3,
// because Claude and ChatGPT parse these exact shapes.
//
// CORS is open (*): every one of these is authenticated by a bearer token or a
// PKCE verifier, never by a cookie, so a browser-based MCP client (e.g. MCP
// Inspector) calling them cross-origin gains nothing it could not do anyway.
// =============================================================================

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-ID",
  "Access-Control-Expose-Headers": "WWW-Authenticate, Mcp-Session-Id, Mcp-Protocol-Version",
  "Access-Control-Max-Age": "86400",
}

export function withCors(res: Response): Response {
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v)
  return res
}

export const preflight = () => new Response(null, { status: 204, headers: CORS_HEADERS })

export function oauthJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { ...CORS_HEADERS, "Cache-Control": "no-store", Pragma: "no-cache" },
  })
}

export function oauthError(error: string, description: string, status = 400): NextResponse {
  return oauthJson({ error, error_description: description }, status)
}

/** Parse an OAuth request body: form-urlencoded per spec, JSON tolerated. */
export async function readForm(req: Request): Promise<URLSearchParams> {
  const type = req.headers.get("content-type") ?? ""
  if (type.includes("application/json")) {
    const json = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const sp = new URLSearchParams()
    for (const [k, v] of Object.entries(json)) if (v != null) sp.set(k, String(v))
    return sp
  }
  return new URLSearchParams(await req.text())
}

/** RFC 9728 Protected Resource Metadata for /api/mcp. */
export function protectedResourceMetadata() {
  return {
    resource: mcpResource(),
    authorization_servers: [issuer()],
    scopes_supported: [...SUPPORTED_SCOPES],
    bearer_methods_supported: ["header"],
    resource_name: "DNMS (Digitally Next HRMS)",
    resource_documentation: `${publicOrigin()}/ai-connections`,
  }
}

/** RFC 8414 Authorization Server Metadata. */
export function authorizationServerMetadata() {
  const e = oauthEndpoints()
  return {
    issuer: issuer(),
    authorization_endpoint: e.authorization,
    token_endpoint: e.token,
    registration_endpoint: e.registration,
    revocation_endpoint: e.revocation,
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    // Public clients only (Claude/ChatGPT CIMD, DCR). Claude requires "none"
    // here to pick CIMD.
    token_endpoint_auth_methods_supported: ["none"],
    revocation_endpoint_auth_methods_supported: ["none"],
    client_id_metadata_document_supported: true,
    // We return `iss` on every authorization response (RFC 9207) - this is
    // what lets ChatGPT use its stable redirect URI.
    authorization_response_iss_parameter_supported: true,
    // offline_access is listed so Claude/ChatGPT know refresh tokens exist;
    // it is NOT in the resource metadata (MCP 2026-07-28 says it must not be).
    scopes_supported: [...SUPPORTED_SCOPES, "offline_access"],
    service_documentation: `${publicOrigin()}/ai-connections`,
    default_scopes: [...DEFAULT_SCOPES],
  }
}
