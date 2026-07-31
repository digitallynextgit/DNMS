import "server-only"

// =============================================================================
// A tiny, dependency-free page auditor. Fetches one URL's HTML and runs the
// on-page SEO checks from the plan's step 6 (titles, single H1, meta, canonical,
// robots directives, JSON-LD schema, image alt text, internal links).
//
// Why hand-rolled instead of Screaming Frog / cheerio:
//   - Screaming Frog free is GUI-only (no CLI/scheduling without the paid
//     licence), so it can't run in a cron - the plan's "Rs 0" claim only holds
//     with a custom crawler.
//   - The checks we actually gate on are simple enough that a few regexes beat
//     pulling in a parser dependency.
// Regex HTML parsing is normally a smell, but here we only extract a handful of
// well-defined tags from <head> and count a few things - not general parsing.
// =============================================================================

const TIMEOUT_MS = 20_000
const MAX_BYTES = 3 * 1024 * 1024 // don't slurp a huge page into memory
const UA = "DNMS-SEO-Bot/1.0 (+https://dnms.digitallynext.com)"

export type IssueLevel = "critical" | "warning" | "info"

export interface PageIssue {
  level: IssueLevel
  code: string
  detail: string
}

export interface PageAudit {
  url: string
  status: number
  ok: boolean
  title: string | null
  titleLength: number
  h1Count: number
  metaDescription: string | null
  metaDescriptionLength: number
  canonical: string | null
  noindex: boolean
  schemaTypes: string[]
  imagesMissingAlt: number
  internalLinks: number
  issues: PageIssue[]
}

const between = (html: string, re: RegExp): string | null => {
  const m = html.match(re)
  return m ? m[1]!.trim() : null
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
}

/** Extract the JSON-LD @type values present in the served HTML. Server-rendered
 *  schema is the ONLY schema Google and AI crawlers see, which is exactly what
 *  the DigitallyNext baseline flagged as missing. */
function extractSchemaTypes(html: string): string[] {
  const types = new Set<string>()
  const blocks = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )
  for (const b of blocks) {
    try {
      const json = JSON.parse(b[1]!.trim())
      const collect = (node: unknown) => {
        if (!node || typeof node !== "object") return
        const obj = node as Record<string, unknown>
        const t = obj["@type"]
        if (typeof t === "string") types.add(t)
        else if (Array.isArray(t)) t.forEach((x) => typeof x === "string" && types.add(x))
        if (Array.isArray(obj["@graph"])) obj["@graph"].forEach(collect)
      }
      if (Array.isArray(json)) json.forEach(collect)
      else collect(json)
    } catch {
      /* malformed JSON-LD - itself worth flagging, handled by caller via empty set */
    }
  }
  return [...types]
}

/** Audit one URL. Never throws - a fetch failure becomes a critical issue on the
 *  returned object so one bad page can't abort a whole run. */
export async function auditPage(url: string, siteHost: string): Promise<PageAudit> {
  const base: PageAudit = {
    url,
    status: 0,
    ok: false,
    title: null,
    titleLength: 0,
    h1Count: 0,
    metaDescription: null,
    metaDescriptionLength: 0,
    canonical: null,
    noindex: false,
    schemaTypes: [],
    imagesMissingAlt: 0,
    internalLinks: 0,
    issues: [],
  }

  let html = ""
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    base.status = res.status
    base.ok = res.ok
    if (!res.ok) {
      base.issues.push({
        level: "critical",
        code: "BAD_STATUS",
        detail: `Returns HTTP ${res.status}. Money pages must return 200.`,
      })
      return base
    }
    // Read at most MAX_BYTES.
    const reader = res.body?.getReader()
    if (reader) {
      const chunks: Uint8Array[] = []
      let total = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) {
          chunks.push(value)
          total += value.length
          if (total > MAX_BYTES) break
        }
      }
      html = Buffer.concat(chunks).toString("utf8")
    } else {
      html = await res.text()
    }
  } catch (err) {
    base.issues.push({
      level: "critical",
      code: "UNREACHABLE",
      detail: `Could not fetch: ${err instanceof Error ? err.message : "unknown error"}`,
    })
    return base
  }

  const head = html.slice(0, html.search(/<\/head>/i) + 7) || html

  // Title
  const rawTitle = between(head, /<title[^>]*>([\s\S]*?)<\/title>/i)
  base.title = rawTitle ? decode(rawTitle) : null
  base.titleLength = base.title?.length ?? 0

  // H1s
  base.h1Count = (html.match(/<h1[\s>]/gi) ?? []).length

  // Meta description
  const md =
    between(head, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) ??
    between(head, /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i)
  base.metaDescription = md ? decode(md) : null
  base.metaDescriptionLength = base.metaDescription?.length ?? 0

  // Canonical
  base.canonical = between(head, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i)

  // Robots meta noindex (also check googlebot-specific)
  const robotsMeta =
    between(head, /<meta[^>]+name=["'](?:robots|googlebot)["'][^>]+content=["']([^"']*)["']/i) ?? ""
  base.noindex = /noindex/i.test(robotsMeta)

  // Schema
  base.schemaTypes = extractSchemaTypes(html)

  // Images missing alt (alt absent OR empty)
  const imgs = html.match(/<img\b[^>]*>/gi) ?? []
  base.imagesMissingAlt = imgs.filter(
    (tag) => !/\balt\s*=\s*["'][^"']*\S[^"']*["']/i.test(tag),
  ).length

  // Internal links (same host)
  const hrefs = html.matchAll(/<a\b[^>]+href=["']([^"']+)["']/gi)
  let internal = 0
  for (const h of hrefs) {
    const href = h[1]!
    if (href.startsWith("/") && !href.startsWith("//")) internal++
    else if (href.includes(siteHost)) internal++
  }
  base.internalLinks = internal

  base.issues = evaluate(base, siteHost)
  return base
}

/** Turn the raw measurements into graded issues. */
function evaluate(p: PageAudit, siteHost: string): PageIssue[] {
  const issues: PageIssue[] = []

  if (p.noindex)
    issues.push({
      level: "critical",
      code: "NOINDEX",
      detail: "Page is set to noindex - it will be dropped from search.",
    })

  if (!p.title) issues.push({ level: "critical", code: "NO_TITLE", detail: "Missing <title> tag." })
  else if (p.titleLength < 15 || p.titleLength > 65)
    issues.push({
      level: "warning",
      code: "TITLE_LENGTH",
      detail: `Title is ${p.titleLength} chars (aim 15-65).`,
    })

  if (p.h1Count === 0)
    issues.push({ level: "warning", code: "NO_H1", detail: "No <h1> on the page." })
  else if (p.h1Count > 1)
    issues.push({
      level: "warning",
      code: "MULTIPLE_H1",
      detail: `${p.h1Count} <h1> tags (should be exactly one).`,
    })

  if (!p.metaDescription)
    issues.push({
      level: "warning",
      code: "NO_META_DESC",
      detail: "Missing meta description - Google writes its own snippet.",
    })
  else if (p.metaDescriptionLength > 165)
    issues.push({
      level: "info",
      code: "META_DESC_LONG",
      detail: `Meta description ${p.metaDescriptionLength} chars (will truncate ~160).`,
    })

  if (!p.canonical)
    issues.push({
      level: "warning",
      code: "NO_CANONICAL",
      detail: "No canonical tag - duplicate-content risk.",
    })

  if (p.schemaTypes.length === 0)
    issues.push({
      level: "warning",
      code: "NO_SCHEMA",
      detail: "No JSON-LD schema in the served HTML - invisible to Google & AI crawlers.",
    })

  if (p.imagesMissingAlt > 0)
    issues.push({
      level: "info",
      code: "IMG_ALT",
      detail: `${p.imagesMissingAlt} image(s) missing alt text.`,
    })

  if (p.internalLinks < 3)
    issues.push({
      level: "info",
      code: "FEW_INTERNAL_LINKS",
      detail: `Only ${p.internalLinks} internal links - thin internal linking.`,
    })

  void siteHost
  return issues
}

/** A page's "topic surface": its title, H1/H2 headings, and same-site links.
 *  Used by the competitor gap analysis (plan step 5) - a page's titles and
 *  headings ARE its keyword map, and the links let us discover more of its
 *  pages without a sitemap. `ok` is false on any fetch failure so a dead
 *  competitor URL never aborts a whole crawl. */
export interface PageOutline {
  url: string
  ok: boolean
  title: string | null
  headings: string[]
  links: string[]
}

const stripTags = (s: string): string => s.replace(/<[^>]+>/g, " ")

/** Fetch one page and pull its title, H1/H2 text, and same-host links. Never
 *  throws. Reuses the same byte cap and UA as {@link auditPage}. */
export async function fetchOutline(url: string, siteHost: string): Promise<PageOutline> {
  const out: PageOutline = { url, ok: false, title: null, headings: [], links: [] }

  let html = ""
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) return out
    const ct = res.headers.get("content-type") ?? ""
    if (ct && !ct.includes("html")) return out // skip PDFs, images, feeds
    const reader = res.body?.getReader()
    if (reader) {
      const chunks: Uint8Array[] = []
      let total = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) {
          chunks.push(value)
          total += value.length
          if (total > MAX_BYTES) break
        }
      }
      html = Buffer.concat(chunks).toString("utf8")
    } else {
      html = await res.text()
    }
    out.ok = true
  } catch {
    return out
  }

  const rawTitle = between(html, /<title[^>]*>([\s\S]*?)<\/title>/i)
  out.title = rawTitle ? decode(rawTitle) : null

  const headings: string[] = []
  for (const m of html.matchAll(/<h[12]\b[^>]*>([\s\S]*?)<\/h[12]>/gi)) {
    const text = decode(stripTags(m[1]!))
    if (text.length >= 3 && text.length <= 90) headings.push(text)
  }
  out.headings = [...new Set(headings)]

  const origin = `https://${siteHost}`
  const links = new Set<string>()
  for (const m of html.matchAll(/<a\b[^>]+href=["']([^"']+)["']/gi)) {
    const href = m[1]!
    if (/^(#|mailto:|tel:|javascript:|data:)/i.test(href)) continue
    try {
      const abs = new URL(href, origin)
      if (abs.hostname.replace(/^www\./, "") !== siteHost.replace(/^www\./, "")) continue
      abs.hash = ""
      links.add(abs.toString())
    } catch {
      /* skip un-parseable href */
    }
  }
  out.links = [...links]
  return out
}

export interface SitemapResult {
  ok: boolean
  urlCount: number
  issue: PageIssue | null
}

/** Fetch and lightly validate sitemap.xml. */
export async function checkSitemap(origin: string): Promise<SitemapResult> {
  const url = `${origin.replace(/\/$/, "")}/sitemap.xml`
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) {
      return {
        ok: false,
        urlCount: 0,
        issue: {
          level: "critical",
          code: "NO_SITEMAP",
          detail: `sitemap.xml returns HTTP ${res.status}. Search engines rely on it for discovery.`,
        },
      }
    }
    const xml = await res.text()
    const count = (xml.match(/<loc>/gi) ?? []).length
    if (count === 0) {
      return {
        ok: false,
        urlCount: 0,
        issue: {
          level: "warning",
          code: "EMPTY_SITEMAP",
          detail: "sitemap.xml has no <loc> URLs.",
        },
      }
    }
    return { ok: true, urlCount: count, issue: null }
  } catch {
    return {
      ok: false,
      urlCount: 0,
      issue: {
        level: "critical",
        code: "NO_SITEMAP",
        detail: "sitemap.xml could not be fetched.",
      },
    }
  }
}

export interface RobotsResult {
  ok: boolean
  issue: PageIssue | null
}

/** Fetch robots.txt and flag the dangerous case: a blanket disallow of the whole
 *  site, which silently deindexes everything. */
export async function checkRobots(origin: string): Promise<RobotsResult> {
  const url = `${origin.replace(/\/$/, "")}/robots.txt`
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) {
      return {
        ok: false,
        issue: {
          level: "warning",
          code: "NO_ROBOTS",
          detail: `robots.txt returns HTTP ${res.status}.`,
        },
      }
    }
    const txt = await res.text()
    // A "Disallow: /" under a wildcard (or no) user-agent blocks the whole site.
    const blanket = /user-agent:\s*\*[\s\S]*?disallow:\s*\/\s*($|\n)/i.test(txt)
    if (blanket) {
      return {
        ok: false,
        issue: {
          level: "critical",
          code: "ROBOTS_BLOCK_ALL",
          detail: "robots.txt disallows the entire site (Disallow: /). Search engines are blocked.",
        },
      }
    }
    return { ok: true, issue: null }
  } catch {
    return {
      ok: false,
      issue: { level: "warning", code: "NO_ROBOTS", detail: "robots.txt could not be fetched." },
    }
  }
}
