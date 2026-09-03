// =============================================================================
// Brand / Strategy workspace - shared types & constants (client-safe).
// Mirrors the ProjectBrand / ContentCalendarEntry Prisma models.
// =============================================================================

export const PLATFORMS = ["Instagram", "Meta", "LinkedIn", "YouTube", "Website", "Other"] as const

export const CONTENT_FORMATS = [
  "Reel",
  "Static",
  "Carousel",
  "Poll",
  "Story",
  "Video",
  "Blog",
  "Other",
] as const

/**
 * Colours + labels for these live in `lib/constants.ts` as
 * CONTENT_CALENDAR_STATUS_COLORS / _LABELS (built from the shared TONE palette),
 * and are rendered through the shared <StatusBadge>.
 */
export const CALENDAR_STATUSES = ["PLANNED", "IN_PROGRESS", "READY", "POSTED"] as const
export type CalendarStatus = (typeof CALENDAR_STATUSES)[number]

// ── Digital objectives (targets) ──
export interface DigitalObjective {
  id: string
  platform: string
  metric: string // e.g. Followers, Likes, Reach
  current: string
  target: string
  deadline: string
}

// ── Manifestation plan: 4 fixed themes, each with social + website notes ──
export const MANIFESTATION_THEMES = [
  { key: "AWARENESS", title: "Brand Awareness", hint: "Knowledge & information" },
  { key: "DEMAND", title: "Demand Generation", hint: "Paid ads" },
  { key: "THOUGHT", title: "Thought Leadership", hint: "Mission / vision - brand & founder" },
  { key: "COMMUNITY", title: "Community Engagement", hint: "Offers, redeem & loyalty programs" },
] as const
export type ManifestationKey = (typeof MANIFESTATION_THEMES)[number]["key"]
export type Manifestation = Record<string, { social: string; website: string }>

// ── Brand guidelines ──
export interface BrandColor {
  name: string
  hex: string
}
export interface BrandGuidelines {
  colors: BrandColor[]
  fonts: string
  logoNotes: string
  uiux: string
}

/**
 * Which section of the Strategy page a file was attached to.
 *
 * ONE FLAT LIST, not a nested "section owns its files" model. An asset row is
 * just a file plus the section it belongs to, so adding a new attachable
 * section is this array plus an <AssetRow> - no migration, no new table.
 *
 * The strings are stored verbatim in BrandAsset.kind, so they are append-only:
 * renaming one orphans every file already filed under the old name. The server
 * validates uploads against this list (see the assets route) - without that, a
 * typo'd kind writes a row that no section on the page will ever render.
 */
export const BRAND_ASSET_KINDS = [
  "BRIEF",
  "OBJECTIVES",
  "MANIFESTATION",
  "OVERVIEW",
  "LOGO",
] as const
export type BrandAssetKind = (typeof BRAND_ASSET_KINDS)[number]

export interface BrandAsset {
  id: string
  /** A BrandAssetKind. Typed loosely because rows predate the constant. */
  kind: BrandAssetKind | string
  fileName: string
  fileSize: number
  mimeType: string
  url: string // signed URL that opens inline (View)
  downloadUrl?: string // signed URL with content-disposition attachment (Download)
  createdAt: string
}

export interface ProjectBrandData {
  brief: string | null
  overview: string | null
  objectives: DigitalObjective[]
  manifestation: Manifestation
  guidelines: BrandGuidelines
  assets: BrandAsset[]
}

export const EMPTY_GUIDELINES: BrandGuidelines = { colors: [], fonts: "", logoNotes: "", uiux: "" }

export function emptyManifestation(): Manifestation {
  const m: Manifestation = {}
  for (const t of MANIFESTATION_THEMES) m[t.key] = { social: "", website: "" }
  return m
}
