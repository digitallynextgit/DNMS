import { NextResponse } from "next/server"
import { CORS_HEADERS, preflight, protectedResourceMetadata } from "@/features/mcp/server/http"

// RFC 9728 metadata for the MCP server, at both the path-suffixed URL our 401 points to and the
// root. Public: proxy.ts lists /.well-known.

export const dynamic = "force-dynamic"

export function GET() {
  return NextResponse.json(protectedResourceMetadata(), {
    headers: { ...CORS_HEADERS, "Cache-Control": "public, max-age=300" },
  })
}

export const OPTIONS = preflight
