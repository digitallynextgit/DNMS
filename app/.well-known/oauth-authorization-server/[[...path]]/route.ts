import { NextResponse } from "next/server"
import { CORS_HEADERS, authorizationServerMetadata, preflight } from "@/features/mcp/server/http"

// RFC 8414 metadata for MCP clients; the catch-all also answers the path-inserted form older
// clients try. Public: proxy.ts lists /.well-known.

export const dynamic = "force-dynamic"

export function GET() {
  return NextResponse.json(authorizationServerMetadata(), {
    headers: { ...CORS_HEADERS, "Cache-Control": "public, max-age=300" },
  })
}

export const OPTIONS = preflight
