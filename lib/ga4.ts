import "server-only"

import { google } from "googleapis"
import { getConfig } from "@/server/app-config"
import { readGoogleCredentials } from "@/lib/google-credentials"

// =============================================================================
// GA4 Data API - organic sessions, engagement and conversions.
//
// Search Console proves people CLICKED; GA4 proves what happened next. Together
// they are 40 of the 100 points in the plan's scorecard ("rankings lead, clicks
// prove, conversions pay").
//
// SETUP (once per property):
//   1. Enable "Google Analytics Data API" on the same Cloud project.
//   2. GA4 -> Admin -> Property access management -> add the service account
//      email with Viewer.
//   3. Paste the numeric property id (Admin -> Property details) into the site's
//      SEO settings.
// =============================================================================

const SCOPES = ["https://www.googleapis.com/auth/analytics.readonly"]

/** Hostnames that identify an AI assistant sending referral traffic. */
const AI_REFERRERS = [
  "chatgpt.com",
  "chat.openai.com",
  "perplexity.ai",
  "gemini.google.com",
  "copilot.microsoft.com",
  "claude.ai",
]

export interface Ga4Result {
  sessions: number
  engagedSessions: number
  conversions: number
  aiReferrals: number
}

export async function isGa4Configured(): Promise<boolean> {
  return !!(await readGoogleCredentials("GA4"))
}

function describeError(err: unknown, propertyId?: string): string {
  const e = err as { code?: number; status?: number; message?: string }
  const code = e?.code ?? e?.status
  const msg = e?.message ?? ""
  if (
    code === 403 &&
    /has not been used in project|SERVICE_DISABLED|accessNotConfigured/i.test(msg)
  ) {
    return "The Google Analytics Data API is not enabled on the Cloud project. Enable 'Google Analytics Data API' in Google Cloud Console, then retry in a few minutes."
  }
  if (code === 403) {
    return `Access denied for GA4 property ${propertyId ?? ""}. Add the service account under GA4 -> Admin -> Property access management (Viewer).`.trim()
  }
  if (code === 404 || /not found/i.test(msg)) {
    return `GA4 property ${propertyId ?? ""} not found. Use the NUMERIC property id (e.g. 123456789), not the measurement id.`.trim()
  }
  return msg || "GA4 request failed"
}

/**
 * Organic-search sessions, engaged sessions, conversions and AI-assistant
 * referrals for one date window. Dates are inclusive "YYYY-MM-DD".
 */
export async function fetchOrganicTraffic(input: {
  propertyId: string
  startDate: string
  endDate: string
}): Promise<Ga4Result> {
  const { propertyId, startDate, endDate } = input
  const creds = await readGoogleCredentials("GA4")
  if (!creds) throw new Error("GA4 is not configured - no Google service-account credentials found")

  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: SCOPES,
  })
  const analytics = google.analyticsdata({ version: "v1beta", auth })
  const property = `properties/${propertyId.replace(/^properties\//, "")}`

  try {
    // Organic search only - paid and direct traffic are not what SEO is judged
    // on, and mixing them would flatter the numbers.
    const [organic, referrals] = await Promise.all([
      analytics.properties.runReport({
        property,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          metrics: [{ name: "sessions" }, { name: "engagedSessions" }, { name: "conversions" }],
          dimensionFilter: {
            filter: {
              fieldName: "sessionDefaultChannelGroup",
              stringFilter: { matchType: "EXACT", value: "Organic Search" },
            },
          },
        },
      }),
      analytics.properties.runReport({
        property,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: "sessionSource" }],
          metrics: [{ name: "sessions" }],
          limit: "200",
        },
      }),
    ])

    const row = organic.data.rows?.[0]?.metricValues ?? []
    const num = (i: number) => Number(row[i]?.value ?? 0) || 0

    let aiReferrals = 0
    for (const r of referrals.data.rows ?? []) {
      const source = (r.dimensionValues?.[0]?.value ?? "").toLowerCase()
      if (AI_REFERRERS.some((h) => source.includes(h))) {
        aiReferrals += Number(r.metricValues?.[0]?.value ?? 0) || 0
      }
    }

    return {
      sessions: Math.round(num(0)),
      engagedSessions: Math.round(num(1)),
      conversions: num(2),
      aiReferrals,
    }
  } catch (err) {
    throw new Error(describeError(err, propertyId))
  }
}
