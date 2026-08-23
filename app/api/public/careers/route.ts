import { NextRequest, NextResponse } from "next/server"
import { getPublishedCareers } from "@/features/careers/server/careers.service"
import { verifyApiKey } from "@/lib/api-key"
import { rateLimited, clientIp } from "@/lib/rate-limit"

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
  // Constant-time compare via the shared helper (SEC-12 / DUP-09).
  if (!verifyApiKey(req.headers.get("x-api-key"), expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS })
  }
  // Even a valid-key job-board read is rate limited per IP (defence in depth).
  if (rateLimited(`careers-read:${clientIp(req)}`, 60, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: CORS_HEADERS })
  }

  // ?mode MUST be exactly full-time or internship. Anything else (typo, missing)
  // is rejected with 400 - we never silently default to full-time.
  const modeParam = req.nextUrl.searchParams.get("mode")
  if (modeParam !== "full-time" && modeParam !== "internship") {
    return NextResponse.json(
      {
        error: "Invalid or missing 'mode'. Use ?mode=full-time or ?mode=internship.",
        received: modeParam,
      },
      { status: 400, headers: CORS_HEADERS },
    )
  }
  const mode = modeParam === "internship" ? "INTERNSHIP" : "FULL_TIME"
  const groups = await getPublishedCareers(mode)

  return NextResponse.json(groups, {
    headers: {
      ...CORS_HEADERS,
      "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
    },
  })
}
