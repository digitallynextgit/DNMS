import "server-only"

import { getConfig } from "@/server/app-config"

// =============================================================================
// Core Web Vitals via Google's free PageSpeed Insights API (v5).
//
// One call returns BOTH:
//   - loadingExperience  = CrUX FIELD data (real Chrome users, 28-day rolling).
//                          This is what Google actually ranks on, but it only
//                          exists for URLs with enough traffic.
//   - lighthouseResult   = LAB data (a synthetic run). Always available, so a
//                          low-traffic page still gets an answer - but it is a
//                          simulation, never a ranking signal.
// We store which source a row came from rather than blending them, because
// telling a client "your LCP is 2.1s" from lab data when field data says 4.8s
// would be actively misleading.
//
// Free quota without a key is heavily rate-limited; with a key it's 25k/day.
// Set GOOGLE_PSI_API_KEY in Admin -> Integrations to get the real quota.
// =============================================================================

const ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"
const TIMEOUT_MS = 60_000

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

// Google's official Core Web Vitals thresholds.
const THRESHOLDS = {
  lcpMs: { good: 2500, poor: 4000 },
  inpMs: { good: 200, poor: 500 },
  cls: { good: 0.1, poor: 0.25 },
} as const

/** All-three-green verdict. Any POOR metric makes the page POOR. */
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

export async function isPsiConfigured(): Promise<boolean> {
  // PSI works without a key (rate-limited), so it is always "available" - this
  // only reports whether we have the full 25k/day quota.
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

const round = (n: number | undefined | null) =>
  n === undefined || n === null ? null : Math.round(n)

/**
 * Fetch Core Web Vitals for one URL. Returns null when the URL can't be
 * measured (unreachable, blocked, quota) - never throws, so one bad page can't
 * abort a whole run.
 */
export async function fetchVitals(
  url: string,
  formFactor: FormFactor = "MOBILE",
): Promise<VitalsResult | null> {
  const key = await getConfig("GOOGLE_PSI_API_KEY")
  const params = new URLSearchParams({
    url,
    strategy: formFactor.toLowerCase(),
    category: "performance",
  })
  if (key) params.set("key", key)

  try {
    const res = await fetch(`${ENDPOINT}?${params}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) {
      console.error("[psi]", url, res.status, (await res.text()).slice(0, 300))
      return null
    }
    const json = (await res.json()) as PsiResponse

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
      return out
    }

    const audits = json.lighthouseResult?.audits
    if (!audits) return null
    const out: VitalsResult = {
      url,
      formFactor,
      source: "PSI_LAB",
      lcpMs: round(audits["largest-contentful-paint"]?.numericValue),
      // Lab runs cannot measure INP (it needs a real interaction); TBT is the
      // documented proxy, but it is NOT the same metric, so leave INP null
      // rather than pass a stand-in off as the real thing.
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
    return out
  } catch (err) {
    console.error("[psi] failed", url, err instanceof Error ? err.message : err)
    return null
  }
}
