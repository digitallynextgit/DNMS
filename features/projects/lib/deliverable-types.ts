// =============================================================================
// What KIND of thing a deliverable is - "Video", "Reel", "Product page".
//
// FREE TEXT WITH A MEMORY, not an enum. Teams here are ad-hoc names per project
// (WEB, DESIGN, VIDEO, SMO, MAP, CONTENT, MVP) and the video team's vocabulary
// is nothing like the web team's. A fixed list would need a migration every
// time a team invented a word for what it makes, and the half-answer ("Other")
// is exactly the value that makes a count untrustworthy.
//
// So: a team-aware STARTER set offered as type-ahead, plus whatever the project
// already uses, and anything typed is accepted. The server snaps a typed value
// onto an existing type's casing when they differ only by case (see
// deliverables.service.ts), so "reel" and "Reel" cannot split a count.
//
// Pure and dependency-free: the form and the server share it.
// =============================================================================

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

/**
 * The starter list for a team - its own vocabulary first, then the generic
 * tail. A team with no recognisable name gets the tail alone; the type-ahead
 * still fills in from what the project already uses.
 */
export function suggestTypes(teamName?: string | null): string[] {
  const own = teamName ? (BY_TEAM.find((t) => t.match.test(teamName))?.types ?? []) : []
  return [...own, ...GENERIC_TYPES.filter((g) => !own.includes(g))]
}

/**
 * Does work on this team normally produce something you can point at?
 *
 * Decides the default for a new task's `producesOutput`: production teams yes,
 * an unrecognised team name yes (the safe default - a nudge costs nothing),
 * adhoc work with no team no. Only a default; every task can flip it.
 */
export function expectsOutput(teamName?: string | null): boolean {
  // Every named team defaults to "yes": the cost of a wrong yes is one nudge
  // somebody skips; the cost of a wrong no is output that never gets counted.
  // The per-team vocabulary above still shapes the SUGGESTIONS, not this.
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
