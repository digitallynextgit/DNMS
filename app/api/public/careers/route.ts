import { NextRequest, NextResponse } from "next/server"
import { getPublishedCareers } from "@/features/careers/server/careers.service"
import { inPublicApiTenant } from "@/server/public-api"
import { verifyApiKey } from "@/lib/api-key"
import { rateLimited, clientIp } from "@/lib/rate-limit"

// Public careers API for the marketing site; returns the PUBLISHED tree. Gated by X-API-Key.
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
  if (!verifyApiKey(req.headers.get("x-api-key"), expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS })
  }
  // Even a valid-key job-board read is rate limited per IP (defence in depth).
  if (rateLimited(`careers-read:${clientIp(req)}`, 60, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: CORS_HEADERS })
  }

  // ?mode must be exactly full-time or internship - never silently defaulted.
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

  try {
    // The verified key identifies the company, so the read runs in that tenant (strict enforcement needs one).
    const groups = await inPublicApiTenant(() => getPublishedCareers(mode))

    return NextResponse.json(groups, {
      headers: {
        ...CORS_HEADERS,
        "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
      },
    })
  } catch (error) {
    // A public, polled endpoint must fail as a response, never as an exception.
    console.error("[PUBLIC_CAREERS]", error)
    return NextResponse.json(
      { error: "Could not load careers" },
      { status: 500, headers: CORS_HEADERS },
    )
  }
}
