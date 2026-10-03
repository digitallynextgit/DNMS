import { NextResponse } from "next/server"
import { CORS_HEADERS, preflight, protectedResourceMetadata } from "@/features/mcp/server/http"

// RFC 9728 Protected Resource Metadata for the DNMS MCP server.
// Served at both /.well-known/oauth-protected-resource/api/mcp (path-suffixed,
// what our 401 points to) and /.well-known/oauth-protected-resource (root,
// which some clients probe). Public: proxy.ts lists /.well-known.

export const dynamic = "force-dynamic"

export function GET() {
  return NextResponse.json(protectedResourceMetadata(), {
    headers: { ...CORS_HEADERS, "Cache-Control": "public, max-age=300" },
  })
}

export const OPTIONS = preflight
