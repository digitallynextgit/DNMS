import "server-only"

import { google } from "googleapis"
import { readGoogleCredentials, googleServiceAccountEmail } from "@/lib/google-credentials"

// =============================================================================
// Google Search Console client (read-only).
//
// Credentials come from lib/google-credentials (GSC_* -> Drive fallback).
//
// SETUP (once per website):
//   Search Console -> Settings -> Users and permissions -> Add user
//   -> paste the service account's client_email -> permission "Full" or
//      "Restricted" (read is enough).
// Without that step every call returns 403 for that property.
// =============================================================================

const SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"]

// GSC data is finalised on a lag; anything newer than this is incomplete and
// would make week-over-week growth look like a crash.
export const GSC_LAG_DAYS = 3

export async function isGscConfigured(): Promise<boolean> {
  return !!(await readGoogleCredentials("GSC"))
}

/** The service account email to add as a user in Search Console (null if unset). */
export async function gscServiceAccountEmail(): Promise<string | null> {
  return googleServiceAccountEmail("GSC")
}

async function getClient() {
  const creds = await readGoogleCredentials("GSC")
  if (!creds) {
    throw new Error(
      "Search Console is not configured - add the service-account JSON as GSC_CREDENTIALS in Admin -> Integrations",
    )
  }
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: SCOPES,
  })
  return google.searchconsole({ version: "v1", auth })
}

/** Turn a Google API error into something a user can act on. */
function describeError(err: unknown, siteUrl?: string): string {
  const e = err as {
    code?: number
    status?: number
    message?: string
    errors?: { reason?: string }[]
  }
  const code = e?.code ?? e?.status
  const msg = e?.message ?? ""

  // 403 has two very different causes and two very different fixes, so tell
  // them apart instead of always blaming permissions.
  if (
    code === 403 &&
    /has not been used in project|SERVICE_DISABLED|accessNotConfigured/i.test(msg)
  ) {
    return "The Google Search Console API is not enabled on the Cloud project. Enable 'Search Console API' in Google Cloud Console -> APIs & Services -> Library, then retry in a few minutes."
  }
  if (code === 403) {
    return `Access denied for ${siteUrl ?? "this property"}. Add the service account as a user in Search Console -> Settings -> Users and permissions.`
  }
  if (code === 404) {
    return `Property ${siteUrl ?? ""} not found in Search Console. Check the exact property id (e.g. "sc-domain:example.com").`.trim()
  }
  if (code === 429) return "Search Console rate limit hit - try again later."
  return e?.message || "Search Console request failed"
}

/** Every property this service account can read - used to help pick `siteUrl`. */
export async function listGscSites(): Promise<{ siteUrl: string; permissionLevel: string }[]> {
  try {
    const sc = await getClient()
    const res = await sc.sites.list()
    return (res.data.siteEntry ?? [])
      .filter((s) => !!s.siteUrl)
      .map((s) => ({
        siteUrl: s.siteUrl as string,
        permissionLevel: s.permissionLevel ?? "unknown",
      }))
  } catch (err) {
    throw new Error(describeError(err))
  }
}

export interface GscRow {
  keys: string[]
  clicks: number
  impressions: number
  ctr: number
  position: number
}

/**
 * Raw Search Analytics query. `dimensions: []` returns a single totals row.
 * Dates are inclusive, "YYYY-MM-DD".
 */
export async function searchAnalytics(input: {
  siteUrl: string
  startDate: string
  endDate: string
  dimensions?: ("query" | "page" | "date" | "country" | "device")[]
  rowLimit?: number
}): Promise<GscRow[]> {
  const { siteUrl, startDate, endDate, dimensions = [], rowLimit = 1000 } = input
  try {
    const sc = await getClient()
    const res = await sc.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions,
        rowLimit: Math.min(rowLimit, 25000),
        // "web" only: Discover/News have different semantics and would muddy
        // the organic-search numbers the report is about.
        type: "web",
      },
    })
    return (res.data.rows ?? []).map((r) => ({
      keys: (r.keys ?? []) as string[],
      clicks: r.clicks ?? 0,
      impressions: r.impressions ?? 0,
      ctr: r.ctr ?? 0,
      position: r.position ?? 0,
    }))
  } catch (err) {
    throw new Error(describeError(err, siteUrl))
  }
}

// --- date helpers -----------------------------------------------------------

export function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/**
 * The most recent COMPLETE reporting window of `days` length, ending far enough
 * back that Search Console has finalised the data.
 */
export function lastCompleteWindow(
  days = 7,
  endingBefore = new Date(),
): { start: string; end: string } {
  const end = new Date(endingBefore)
  end.setUTCDate(end.getUTCDate() - GSC_LAG_DAYS)
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - (days - 1))
  return { start: toDateKey(start), end: toDateKey(end) }
}

/** The window of the same length immediately before `start` (for growth deltas). */
export function previousWindow(start: string, days = 7): { start: string; end: string } {
  const prevEnd = new Date(`${start}T00:00:00Z`)
  prevEnd.setUTCDate(prevEnd.getUTCDate() - 1)
  const prevStart = new Date(prevEnd)
  prevStart.setUTCDate(prevStart.getUTCDate() - (days - 1))
  return { start: toDateKey(prevStart), end: toDateKey(prevEnd) }
}
