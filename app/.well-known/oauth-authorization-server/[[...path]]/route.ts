import { NextResponse } from "next/server"
import { CORS_HEADERS, authorizationServerMetadata, preflight } from "@/features/mcp/server/http"

// RFC 8414 Authorization Server Metadata - how Claude and ChatGPT find the
// DNMS authorize / token / register endpoints. The optional catch-all also
// answers the path-inserted form (/.well-known/oauth-authorization-server/...)
// that some older MCP clients try. Public: proxy.ts lists /.well-known.

export const dynamic = "force-dynamic"

export function GET() {
  return NextResponse.json(authorizationServerMetadata(), {
    headers: { ...CORS_HEADERS, "Cache-Control": "public, max-age=300" },
  })
}

export const OPTIONS = preflight
