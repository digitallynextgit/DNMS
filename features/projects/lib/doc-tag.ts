/**
 * What KIND of document a file is (unlike the pipeline's ResourceCategory). Guessed on upload,
 * editable later; unsure guesses go to OTHER. Pure, so every caller classifies alike.
 */

export const DOC_TAGS = [
  "BRAND",
  "STRATEGY",
  "RESEARCH",
  "JOURNEY",
  "REPORT",
  "CREATIVE",
  "VIDEO",
  "PRODUCT",
  "LEGAL",
  "OTHER",
] as const

export type DocTag = (typeof DOC_TAGS)[number]

export const DOC_TAG_LABEL: Record<DocTag, string> = {
  BRAND: "Brand",
  STRATEGY: "Strategy",
  RESEARCH: "Research",
  JOURNEY: "Journey",
  REPORT: "Report",
  CREATIVE: "Creative",
  VIDEO: "Video",
  PRODUCT: "Product",
  LEGAL: "Legal",
  OTHER: "Other",
}

export const DOC_TAG_HINT: Record<DocTag, string> = {
  BRAND: "Brand books, briefs, guidelines, story",
  STRATEGY: "Plans, strategies, campaign concepts, calendars",
  RESEARCH: "Competitor and market analysis, personas, reviews",
  JOURNEY: "User journeys, journey maps, acquisition and retention flows",
  REPORT: "Metrics, LTV/CLV, performance and analytics write-ups",
  CREATIVE: "Artwork, banners, social posts, design files",
  VIDEO: "Video files",
  PRODUCT: "Catalogues, pricing, specs, product photography",
  LEGAL: "Incorporation papers, agreements, certificates, invoices",
  OTHER: "Everything else",
}

/** Chip colours: semantic where a state exists (LEGAL = careful), else spread so tags differ. */
export const DOC_TAG_STYLE: Record<DocTag, string> = {
  BRAND: "bg-violet-500/12 text-violet-500",
  STRATEGY: "bg-blue-500/12 text-blue-500",
  RESEARCH: "bg-cyan-500/12 text-cyan-500",
  JOURNEY: "bg-teal-500/12 text-teal-500",
  REPORT: "bg-emerald-500/12 text-emerald-500",
  CREATIVE: "bg-pink-500/12 text-pink-500",
  VIDEO: "bg-orange-500/12 text-orange-500",
  PRODUCT: "bg-amber-500/12 text-amber-500",
  LEGAL: "bg-red-500/12 text-red-500",
  OTHER: "bg-muted text-muted-foreground",
}

/**
 * Keyword rules IN PRIORITY ORDER - first match wins, so specific nouns (competitor, journey,
 * brand) come before generic ones (report). Phrases where a bare word would overreach.
 */
const RULES: { tag: DocTag; patterns: RegExp[] }[] = [
  {
    tag: "LEGAL",
    patterns: [
      /\b(coi|moa|aoa|pan|gst|cin|tan)\b/,
      /\b(incorporat|certificate|agreement|contract|nda|invoice|licen[cs]e|trademark|compliance|msds|affidavit|deed)/,
    ],
  },
  {
    tag: "BRAND",
    patterns: [
      /\bbrand\b/,
      /brand[_\s-]?(book|brief|guide|guideline|story|identity|kit)/,
      /\b(logo|tone of voice|style guide)\b/,
    ],
  },
  {
    tag: "JOURNEY",
    patterns: [
      /\b(user|customer|buyer|consumer)[_\s-]?journey/,
      /journey[_\s-]?(map|flow)/,
      /\bjourney\b/,
      /post[_\s-]?purchase/,
      /\b(acquisition|retention|onboarding)\b/,
      /\bfunnel\b/,
    ],
  },
  {
    tag: "RESEARCH",
    patterns: [
      /\bcompetitor|competitive\b/,
      /\bpersona\b/,
      /voice of the customer|\bvoc\b/,
      /\breview(s)?\b/,
      /case[_\s-]?stud(y|ies)/,
      /\bmarketplace|\bmarket research|\bbenchmark/,
      /\b(analysis|audit|opportunity|survey|insight(s)?)\b/,
    ],
  },
  {
    tag: "STRATEGY",
    patterns: [
      /\bstrateg(y|ic|ies)\b/,
      /\bplan\b|\bplanning\b/,
      /\bmanifestation\b/,
      /\bcampaign\b/,
      /\bcalendar\b/,
      /\broadmap\b/,
      /\b(growth|nurturing|ecosystem|positioning|gtm|go[_\s-]?to[_\s-]?market)\b/,
    ],
  },
  {
    tag: "PRODUCT",
    patterns: [
      /catalogue|catalog/,
      /\bpricing\b|\bprice[_\s-]?list\b|\brate[_\s-]?card\b/,
      /product[_\s-]?(image|photo|shot|spec|sheet)/,
      /\b(chemical(s)?|ingredient(s)?|formulation|datasheet)\b/,
      /\bsku[_\s-]?(list|master)\b/,
    ],
  },
  {
    tag: "REPORT",
    patterns: [
      /\bltv\b|\bclv\b|\bcac\b|\broi\b|\broas\b/,
      /\bmetric(s)?\b|\banalytic(s)?\b|\bkpi(s)?\b/,
      /\bperformance\b|\bdashboard\b/,
      /\b7ps\b/,
      /\breport(ing)?\b|\bsummary\b/,
    ],
  },
  {
    tag: "CREATIVE",
    patterns: [
      /\bcreative(s)?\b/,
      /\bbanner\b|\bartboard\b|\bmockup\b|\bthumbnail\b/,
      /\bemailer\b|\bemail[_\s-]?design\b/,
      /\b(post|reel|story|carousel)[_\s-]?(design|creative)\b/,
      /\bdesign\b/,
    ],
  },
]

/** Extensions that decide the tag on their own, whatever the name says. */
const VIDEO_EXT = /\.(mp4|mov|avi|mkv|webm|m4v|mpg|mpeg)$/i
const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|svg|tiff?|heic|avif|ai|psd|eps|indd|sketch|fig)$/i

/** Guess a tag from name, path and MIME. The folder path carries signal too, so it is matched. */
export function classifyDoc(input: {
  name: string
  mimeType?: string | null
  path?: string
}): DocTag {
  const name = input.name ?? ""
  const mime = (input.mimeType ?? "").toLowerCase()

  // Separators to spaces first: `_` is a word char, so `\bstrategy\b` misses "Growth_Strategy".
  const haystack = `${input.path ?? name}`
    .toLowerCase()
    .replace(/\\/g, "/")
    .replace(/[_.\-–-]+/g, " ")

  // Format first: a .mp4 is a video whatever its folder says.
  if (mime.startsWith("video/") || VIDEO_EXT.test(name)) return "VIDEO"

  for (const { tag, patterns } of RULES) {
    if (patterns.some((p) => p.test(haystack))) return tag
  }

  // No keyword matched: fall back to format (an image is artwork).
  if (mime.startsWith("image/") || IMAGE_EXT.test(name)) return "CREATIVE"

  return "OTHER"
}

export function isDocTag(value: unknown): value is DocTag {
  return typeof value === "string" && (DOC_TAGS as readonly string[]).includes(value)
}
