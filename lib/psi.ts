import "server-only"

import { getConfig } from "@/server/app-config"

// Core Web Vitals via PageSpeed Insights v5. Field data (CrUX, real users) is preferred over lab
// data; rows record which one they came from, never a blend.
// Needs GOOGLE_PSI_API_KEY: keyless calls hit a shared, usually exhausted quota and 429 at once.

const ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"
const TIMEOUT_MS = 60_000

// Retry burst limits only; a daily limit is detected separately and never retried.
const BACKOFF_MS = [2_000, 8_000] as const

export type FormFactor = "MOBILE" | "DESKTOP"
export type Verdict = "GOOD" | "NEEDS_IMPROVEMENT" | "POOR"

export interface VitalsResult {
  url: string
  formFactor: FormFactor
  source: "CRUX_FIELD" | "PSI_LAB"
  lcpMs: number | null
  inpMs: number | null
  cls: number | null
  fcpMs: number | null
  ttfbMs: number | null
  performanceScore: number | null
  verdict: Verdict | null
}

/** UNMEASURABLE is about one page (carry on); QUOTA is about the API (stop the run). */
export type VitalsOutcome =
  | { ok: true; vitals: VitalsResult }
  | { ok: false; reason: "UNMEASURABLE"; message: string }
  | { ok: false; reason: "QUOTA"; message: string }

// Google's official Core Web Vitals thresholds.
const THRESHOLDS = {
  lcpMs: { good: 2500, poor: 4000 },
  inpMs: { good: 200, poor: 500 },
  cls: { good: 0.1, poor: 0.25 },
} as const

/** Any POOR metric makes the page POOR. */
export function verdictFor(v: Pick<VitalsResult, "lcpMs" | "inpMs" | "cls">): Verdict | null {
  const parts: Verdict[] = []
  for (const [key, t] of Object.entries(THRESHOLDS) as [
    keyof typeof THRESHOLDS,
    { good: number; poor: number },
  ][]) {
    const value = v[key]
    if (value === null || value === undefined) continue
    parts.push(value <= t.good ? "GOOD" : value <= t.poor ? "NEEDS_IMPROVEMENT" : "POOR")
  }
  if (parts.length === 0) return null
  if (parts.includes("POOR")) return "POOR"
  if (parts.includes("NEEDS_IMPROVEMENT")) return "NEEDS_IMPROVEMENT"
  return "GOOD"
}

/** Without our own key PSI is effectively unusable, so false means not configured. */
export async function isPsiConfigured(): Promise<boolean> {
  return !!(await getConfig("GOOGLE_PSI_API_KEY"))
}

type PsiResponse = {
  loadingExperience?: {
    metrics?: Record<string, { percentile?: number; category?: string }>
  }
  lighthouseResult?: {
    categories?: { performance?: { score?: number } }
    audits?: Record<string, { numericValue?: number }>
  }
  error?: { message?: string }
}

type PsiErrorBody = {
  error?: {
    message?: string
    details?: { metadata?: { quota_limit?: string } }[]
  }
}

const round = (n: number | undefined | null) =>
  n === undefined || n === null ? null : Math.round(n)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Burst vs daily quota. Unrecognised counts as daily: a wrong "burst" guess causes a retry storm. */
function isDailyQuota(body: string): boolean {
  let message = body
  let limit = ""
  try {
    const parsed = JSON.parse(body) as PsiErrorBody
    message = parsed.error?.message ?? body
    limit = parsed.error?.details?.find((d) => d.metadata?.quota_limit)?.metadata?.quota_limit ?? ""
  } catch {
    // Non-JSON body - fall through and match against the raw text.
  }
  const haystack = `${message} ${limit}`.toLowerCase()
  return !(
    haystack.includes("per minute") ||
    haystack.includes("perminute") ||
    haystack.includes("per 100 seconds")
  )
}

function retryAfterMs(res: Response): number | null {
  const raw = res.headers.get("retry-after")
  if (!raw) return null
  const secs = Number(raw)
  return Number.isFinite(secs) && secs > 0 ? Math.min(secs * 1000, 30_000) : null
}

function quotaMessage(daily: boolean, hasKey: boolean): string {
  if (!hasKey) {
    return (
      "PageSpeed Insights quota exhausted: no GOOGLE_PSI_API_KEY is set, so calls are billed " +
      "to Google's shared anonymous project, whose daily allowance is normally already spent. " +
      "Add a free key under Admin -> Integrations (Google Cloud Console -> enable the " +
      "PageSpeed Insights API -> Credentials -> API key) for 25,000 calls/day."
    )
  }
  return daily
    ? "PageSpeed Insights daily quota (25,000 calls) exhausted for this API key; it resets at midnight Pacific."
    : "PageSpeed Insights burst limit (240 calls/minute) still hit after retries."
}

type CallResult =
  | { ok: true; json: PsiResponse }
  | { ok: false; reason: "UNMEASURABLE" | "QUOTA"; message: string }

async function callPsi(params: URLSearchParams, hasKey: boolean): Promise<CallResult> {
  for (let attempt = 0; ; attempt++) {
    let res: Response
    try {
      res = await fetch(`${ENDPOINT}?${params}`, { signal: AbortSignal.timeout(TIMEOUT_MS) })
    } catch (err) {
      return {
        ok: false,
        reason: "UNMEASURABLE",
        message: err instanceof Error ? err.message : String(err),
      }
    }

    if (res.ok) {
      try {
        return { ok: true, json: (await res.json()) as PsiResponse }
      } catch {
        return { ok: false, reason: "UNMEASURABLE", message: "Malformed PSI response" }
      }
    }

    const body = await res.text().catch(() => "")

    // 429 (quota) and 403 (bad key / API off) aren't about this URL, so abort the run.
    if (res.status === 429 || res.status === 403) {
      const daily = res.status === 403 ? true : isDailyQuota(body)
      // BACKOFF_MS bounds the retries; Retry-After only changes the wait, never whether we retry.
      const backoff = BACKOFF_MS[attempt]
      if (daily || backoff === undefined) {
        return { ok: false, reason: "QUOTA", message: quotaMessage(daily, hasKey) }
      }
      await sleep(retryAfterMs(res) ?? backoff)
      continue
    }

    return {
      ok: false,
      reason: "UNMEASURABLE",
      message: `PSI ${res.status} ${body.slice(0, 120).replace(/\s+/g, " ").trim()}`,
    }
  }
}

/** Never throws. */
export async function fetchVitals(
  url: string,
  formFactor: FormFactor = "MOBILE",
): Promise<VitalsOutcome> {
  const key = await getConfig("GOOGLE_PSI_API_KEY")
  const params = new URLSearchParams({
    url,
    strategy: formFactor.toLowerCase(),
    category: "performance",
  })
  if (key) params.set("key", key)

  const call = await callPsi(params, !!key)
  if (!call.ok) return call
  const json = call.json

  // Prefer real-user field data; fall back to the lab run.
  const field = json.loadingExperience?.metrics
  if (field && Object.keys(field).length > 0) {
    const out: VitalsResult = {
      url,
      formFactor,
      source: "CRUX_FIELD",
      lcpMs: round(field.LARGEST_CONTENTFUL_PAINT_MS?.percentile),
      inpMs: round(field.INTERACTION_TO_NEXT_PAINT?.percentile),
      // CrUX reports CLS x100 as an integer.
      cls:
        field.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile !== undefined
          ? field.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100
          : null,
      fcpMs: round(field.FIRST_CONTENTFUL_PAINT_MS?.percentile),
      ttfbMs: round(field.EXPERIMENTAL_TIME_TO_FIRST_BYTE?.percentile),
      performanceScore:
        json.lighthouseResult?.categories?.performance?.score !== undefined
          ? Math.round((json.lighthouseResult.categories.performance.score ?? 0) * 100)
          : null,
      verdict: null,
    }
    out.verdict = verdictFor(out)
    return { ok: true, vitals: out }
  }

  const audits = json.lighthouseResult?.audits
  if (!audits) {
    return { ok: false, reason: "UNMEASURABLE", message: "No field or lab data in PSI response" }
  }
  const out: VitalsResult = {
    url,
    formFactor,
    source: "PSI_LAB",
    lcpMs: round(audits["largest-contentful-paint"]?.numericValue),
    // Lab runs can't measure INP; TBT is only a proxy, so leave it null.
    inpMs: null,
    cls: audits["cumulative-layout-shift"]?.numericValue ?? null,
    fcpMs: round(audits["first-contentful-paint"]?.numericValue),
    ttfbMs: round(audits["server-response-time"]?.numericValue),
    performanceScore:
      json.lighthouseResult?.categories?.performance?.score !== undefined
        ? Math.round((json.lighthouseResult.categories.performance.score ?? 0) * 100)
        : null,
    verdict: null,
  }
  out.verdict = verdictFor(out)
  return { ok: true, vitals: out }
}
