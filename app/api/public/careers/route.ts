import { NextRequest, NextResponse } from "next/server"
import { getPublishedCareers } from "@/features/careers/server/careers.service"
import { toDbMode } from "@/features/careers/careers.types"

// Public Careers API consumed by the marketing site. Returns the PUBLISHED
// careers tree for the requested mode in the CareersDepartmentGroup[] contract
// (see temp/README.md §4). Gated by the X-API-Key header.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
  "Access-Control-Max-Age": "86400",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(req: NextRequest) {
  const expected = process.env.CAREERS_API_KEY
  if (!expected) {
    return NextResponse.json(
      { error: "CAREERS_API_KEY is not configured on the server" },
      { status: 500, headers: CORS_HEADERS },
    )
  }
  const provided = req.headers.get("x-api-key")
  if (!provided || provided !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS })
  }

  // ?mode=full-time (default) | internship
  const mode = toDbMode(req.nextUrl.searchParams.get("mode"))
  const groups = await getPublishedCareers(mode)

  return NextResponse.json(groups, {
    headers: {
      ...CORS_HEADERS,
      "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
    },
  })
}
