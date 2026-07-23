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

export interface BrandAsset {
  id: string
  kind: "BRIEF" | "LOGO" | string
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

export interface ContentEntry {
  id: string
  date: string | null // "YYYY-MM-DD"
  platform: string | null
  theme: string | null
  format: string | null
  hook: string | null
  content: string | null
  status: string
  link: string | null
  /** Who owns writing/publishing this post. Setting it mirrors the entry as a
   *  task on that person's board and turns on publish-day reminders. */
  assigneeId?: string | null
  assignee?: { id: string; firstName: string; lastName: string } | null
  /** The mirrored ProjectTask, when there is one. */
  taskId?: string | null
}

export const EMPTY_GUIDELINES: BrandGuidelines = { colors: [], fonts: "", logoNotes: "", uiux: "" }

export function emptyManifestation(): Manifestation {
  const m: Manifestation = {}
  for (const t of MANIFESTATION_THEMES) m[t.key] = { social: "", website: "" }
  return m
}
