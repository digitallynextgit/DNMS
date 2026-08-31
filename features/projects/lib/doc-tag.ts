/**
 * What KIND of document a project file is.
 *
 * Separate from `ResourceCategory` (BRIEFS / ASSETS / DELIVERABLES / …), which
 * describes where a file sits in the delivery pipeline. This describes what is
 * inside it. A brand brief and a competitor analysis are both "BRIEFS" to the
 * pipeline and are nothing like each other to the person hunting for one.
 *
 * ── WHY IT IS DERIVED, NOT ASKED FOR ─────────────────────────────────────────
 * The upload flow is a file picker and a button. Any tag the uploader has to
 * choose is a tag most uploads will not have, and a filter that only covers a
 * third of the table is worse than no filter - people stop trusting it. So the
 * tag is guessed from the file, stored on upload, and left editable afterwards.
 *
 * A guess is honest about being a guess: `classifyDoc` returns OTHER rather
 * than forcing a file into the nearest bucket, and OTHER is a filterable value
 * so nothing becomes unfindable.
 *
 * PURE AND DEPENDENCY-FREE on purpose - the upload route, the import script and
 * the browser all classify with this same function, so a file tagged during a
 * bulk import and the same file uploaded by hand land on the same tag.
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

/** One line each, for the filter dropdown - a tag nobody can define is a tag nobody picks. */
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

/**
 * Chip colours. Semantic where a state exists (LEGAL reads as "handle with
 * care"), otherwise a spread across the palette wide enough that two tags never
 * look like the same tag in a column scanned at speed.
 */
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

// ─────────────────────────────────────────────────────────────────────────────
// Classification
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Keyword rules, IN PRIORITY ORDER. First match wins, so the order is the whole
 * design: SPECIFIC nouns are tested before GENERIC ones.
 *
 * "Report" is generic - a competitor analysis, an LTV model and a journey map
 * are all called reports around here - so it is tested last of the document
 * tags. "Competitor", "journey" and "brand" name one thing each, so they are
 * tested first and win the tie. That single ordering rule is what gets
 * "Rudione_User_Journey_Acquisition_Report.docx" onto JOURNEY instead of
 * REPORT, and "Voice of the Customer (VOC) Strategic Report" onto RESEARCH
 * instead of STRATEGY.
 *
 * Phrases, not bare words, wherever a bare word would overreach: "brand story"
 * rather than "story" (which would swallow "Manifestation Story Themes"), and
 * "product catalogue" / "product image" rather than "product" (which would
 * swallow "Product Lifecycle Report").
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

/**
 * Guess a tag from a file's name, path and MIME type.
 *
 * `path` is the archive- or folder-relative path when there is one. Folders
 * carry real signal - "LTV per SKU/CarpetCare.docx" is only identifiable as a
 * report because of the folder - so the path is matched, not just the leaf.
 */
export function classifyDoc(input: {
  name: string
  mimeType?: string | null
  path?: string
}): DocTag {
  const name = input.name ?? ""
  const mime = (input.mimeType ?? "").toLowerCase()

  // Separators become spaces BEFORE any rule runs. Underscore is a word
  // character in JS regex, so `\bstrategy\b` does not match inside
  // "Growth_Strategy_Document" - and roughly half the real filenames here are
  // underscore-separated, which quietly sent them all to OTHER. Normalising
  // once is the fix; the alternative is remembering it in every pattern.
  const haystack = `${input.path ?? name}`
    .toLowerCase()
    .replace(/\\/g, "/")
    .replace(/[_.\-–—]+/g, " ")

  // Format first. A .mp4 is a video whatever it is called, and calling the
  // Instagram export "Insta images/…mp4" a creative because of its folder would
  // put a video in the image bucket.
  if (mime.startsWith("video/") || VIDEO_EXT.test(name)) return "VIDEO"

  for (const { tag, patterns } of RULES) {
    if (patterns.some((p) => p.test(haystack))) return tag
  }

  // No keyword matched. Fall back to format: artwork is the one kind of file
  // whose type alone tells you what it is for.
  if (mime.startsWith("image/") || IMAGE_EXT.test(name)) return "CREATIVE"

  return "OTHER"
}

/** Narrowing helper for values arriving from the wire or the database. */
export function isDocTag(value: unknown): value is DocTag {
  return typeof value === "string" && (DOC_TAGS as readonly string[]).includes(value)
}
