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

export const CALENDAR_STATUSES = ["PLANNED", "IN_PROGRESS", "READY", "POSTED"] as const
export type CalendarStatus = (typeof CALENDAR_STATUSES)[number]

export const CALENDAR_STATUS_META: Record<string, { label: string; cls: string }> = {
  PLANNED: { label: "Planned", cls: "bg-muted text-muted-foreground" },
  IN_PROGRESS: {
    label: "In progress",
    cls: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  },
  READY: {
    label: "Ready",
    cls: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
  },
  POSTED: {
    label: "Posted",
    cls: "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300",
  },
}

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
  url: string // signed download URL
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
}

export const EMPTY_GUIDELINES: BrandGuidelines = { colors: [], fonts: "", logoNotes: "", uiux: "" }

export function emptyManifestation(): Manifestation {
  const m: Manifestation = {}
  for (const t of MANIFESTATION_THEMES) m[t.key] = { social: "", website: "" }
  return m
}
