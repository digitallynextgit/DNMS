export const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const
export type UtmKey = (typeof UTM_KEYS)[number]
export type UtmValues = Record<UtmKey, string>

export const REQUIRED_UTM: readonly UtmKey[] = ["utm_source", "utm_medium", "utm_campaign"]

export const SOURCE_CHIPS = [
  "google",
  "facebook",
  "instagram",
  "linkedin",
  "youtube",
  "newsletter",
  "whatsapp",
] as const
export const MEDIUM_CHIPS = [
  "cpc",
  "paid_social",
  "social",
  "email",
  "organic",
  "referral",
  "display",
] as const

export function emptyUtm(): UtmValues {
  return { utm_source: "", utm_medium: "", utm_campaign: "", utm_term: "", utm_content: "" }
}

export type WebsiteUrl =
  | { ok: true; url: URL; addedScheme: boolean }
  | { ok: false; reason: "empty" | "spaces" | "invalid" }

/** https:// is added when there's no scheme; only http(s) links with a real-looking host pass. */
export function parseWebsiteUrl(input: string): WebsiteUrl {
  const raw = input.trim()
  if (!raw) return { ok: false, reason: "empty" }
  if (/\s/.test(raw)) return { ok: false, reason: "spaces" }
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw)
  const text = hasScheme ? raw : `https://${raw.replace(/^\/\//, "")}`
  let url: URL
  try {
    url = new URL(text)
  } catch {
    return { ok: false, reason: "invalid" }
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { ok: false, reason: "invalid" }
  const host = url.hostname
  const labels = host.split(".")
  const lastLabel = labels[labels.length - 1] ?? ""
  const looksReal =
    host === "localhost" ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(host) ||
    (labels.length >= 2 && labels.every(Boolean) && lastLabel.length >= 2)
  if (!looksReal) return { ok: false, reason: "invalid" }
  return { ok: true, url, addedScheme: !hasScheme }
}

/**
 * With `clean`: lowercase, spaces to hyphens ("Diwali Sale" -> "diwali-sale"), because analytics
 * treats "Facebook" and "facebook" as two sources.
 */
export function cleanUtmValue(value: string, clean: boolean): string {
  const v = value.trim()
  if (!clean) return v
  return v.toLowerCase().replace(/\s+/g, "-").replace(/-{2,}/g, "-")
}

export function cleanUtmValues(values: UtmValues, clean: boolean): UtmValues {
  const out = emptyUtm()
  for (const key of UTM_KEYS) out[key] = cleanUtmValue(values[key], clean)
  return out
}

export function missingUtm(values: UtmValues): UtmKey[] {
  return REQUIRED_UTM.filter((k) => !values[k].trim())
}

function decodePart(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, " "))
  } catch {
    return s
  }
}

/** The raw "a=1&b=2" pieces of a URL's query, untouched (so their encoding is kept). */
function queryParts(url: URL): string[] {
  const q = url.search.replace(/^\?/, "")
  return q ? q.split("&").filter(Boolean) : []
}

function partKey(part: string): string {
  return decodePart(part.split("=")[0] ?? "").toLowerCase()
}

/** Keeps the page's own query and #hash, swaps any existing utm_* tags and drops empty ones. */
export function buildUtmLink(url: URL, values: UtmValues): { link: string; replaced: string[] } {
  const out = new URL(url.href)
  const parts: string[] = []
  const replaced: string[] = []
  for (const part of queryParts(out)) {
    const key = partKey(part)
    if (key.startsWith("utm_")) replaced.push(key)
    else parts.push(part)
  }
  for (const key of UTM_KEYS) {
    const v = values[key].trim()
    if (v) parts.push(`${key}=${encodeURIComponent(v)}`)
  }
  out.search = parts.length ? `?${parts.join("&")}` : ""
  return { link: out.href, replaced }
}

export function splitUtmLink(link: string): { base: string; values: UtmValues } | null {
  let url: URL
  try {
    url = new URL(link)
  } catch {
    return null
  }
  const values = emptyUtm()
  const kept: string[] = []
  for (const part of queryParts(url)) {
    const key = partKey(part)
    if ((UTM_KEYS as readonly string[]).includes(key)) {
      const eq = part.indexOf("=")
      values[key as UtmKey] = eq === -1 ? "" : decodePart(part.slice(eq + 1))
    } else if (!key.startsWith("utm_")) {
      kept.push(part)
    }
  }
  url.search = kept.length ? `?${kept.join("&")}` : ""
  return { base: url.href, values }
}

export type SourceMediumHint = "swapped" | "source-is-medium" | "medium-is-source"

/** Spots "cpc" as the source or "facebook" as the medium (or both swapped). A hint, not an error. */
export function sourceMediumHint(source: string, medium: string): SourceMediumHint | null {
  const s = source.trim().toLowerCase()
  const m = medium.trim().toLowerCase()
  const isMedium = (v: string) => (MEDIUM_CHIPS as readonly string[]).includes(v)
  const isSource = (v: string) => (SOURCE_CHIPS as readonly string[]).includes(v)
  if (isMedium(s) && isSource(m)) return "swapped"
  if (isSource(m)) return "medium-is-source"
  if (isMedium(s)) return "source-is-medium"
  return null
}

export interface RecentLink {
  link: string
  /** When it was last copied or downloaded, ms since epoch. */
  at: number
}

export const RECENT_MAX = 10

export function parseRecent(raw: string | null): RecentLink[] {
  if (!raw) return []
  try {
    const data: unknown = JSON.parse(raw)
    if (!Array.isArray(data)) return []
    return data
      .filter(
        (r): r is RecentLink =>
          !!r &&
          typeof r === "object" &&
          typeof (r as RecentLink).link === "string" &&
          typeof (r as RecentLink).at === "number",
      )
      .slice(0, RECENT_MAX)
  } catch {
    return []
  }
}

export function addRecent(list: RecentLink[], link: string, at: number): RecentLink[] {
  return [{ link, at }, ...list.filter((r) => r.link !== link)].slice(0, RECENT_MAX)
}

export function removeRecent(list: RecentLink[], link: string): RecentLink[] {
  return list.filter((r) => r.link !== link)
}
