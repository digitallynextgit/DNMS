// Deliverable type is free text, not an enum: teams invent their own words. A team-aware starter
// set is offered as type-ahead; the server snaps case-only differences onto the existing type.

export const MAX_TYPE_LENGTH = 40
export const MAX_QUANTITY = 999
export const MAX_LINKS = 20

/** Matched against the team's NAME, which is the only signal there is. */
const BY_TEAM: { match: RegExp; types: string[] }[] = [
  {
    match: /video|reel|motion|edit|film/i,
    types: ["Video", "Reel", "Short", "Thumbnail", "Motion graphic", "Edit"],
  },
  {
    match: /design|creative|brand|graphic|ui/i,
    types: ["Creative", "Banner", "Packaging", "Logo", "Illustration", "Mockup"],
  },
  {
    match: /web|dev|mvp|app|tech|build/i,
    types: ["Page", "Feature", "Bug fix", "Integration", "Release", "Component"],
  },
  {
    match: /smo|social|smm|community/i,
    types: ["Post", "Story", "Carousel", "Campaign", "Caption set"],
  },
  {
    match: /content|copy|blog|seo|writ/i,
    types: ["Blog", "Script", "Copy", "Article", "Keyword set"],
  },
  {
    match: /map|marketing|ads|performance|growth/i,
    types: ["Ad creative", "Campaign", "Landing page", "Report", "Audit"],
  },
]

/** Offered on every team, after the team-specific ones. */
export const GENERIC_TYPES = ["Asset", "Document", "Report", "Other"] as const

export function suggestTypes(teamName?: string | null): string[] {
  const own = teamName ? (BY_TEAM.find((t) => t.match.test(teamName))?.types ?? []) : []
  return [...own, ...GENERIC_TYPES.filter((g) => !own.includes(g))]
}

/** Default for a new task's `producesOutput`: any named team yes, no team (adhoc) no. */
export function expectsOutput(teamName?: string | null): boolean {
  // A wrong yes costs one skipped nudge; a wrong no leaves output uncounted.
  return Boolean(teamName)
}

/** Trim and collapse. The length cap is enforced by the caller, with a message. */
export function cleanType(raw: string): string {
  return raw.trim().replace(/\s+/g, " ")
}

/** The grouping key: case-insensitive, so one type is one row in every count. */
export function typeKey(type: string): string {
  return cleanType(type).toLowerCase()
}
