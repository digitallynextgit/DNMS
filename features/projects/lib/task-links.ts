// =============================================================================
// Resource links on a task: the brief, the doc, the published page.
//
// Shared by the API and the sheet so the rule that decides what is accepted is
// the same one that decides what the cell offers to save.
// =============================================================================

/**
 * http(s) only, and only what actually parses.
 *
 * These render as clickable anchors for the whole team, so a cell anyone can
 * type in is a cell where "javascript:alert(1)" can be typed. Scheme-checking
 * the PARSED url rather than the raw string is what makes that safe - a
 * "https://evil" prefix check would pass "javascript:https://…".
 */
export function isSafeHttpUrl(value: string): boolean {
  try {
    const u = new URL(value.trim())
    return (u.protocol === "http:" || u.protocol === "https:") && !!u.hostname
  } catch {
    return false
  }
}

/**
 * What a link is called in the grid: its host, minus the "www.", plus a hint of
 * the path so three Google Docs are distinguishable from each other.
 */
export function linkLabel(value: string): string {
  try {
    const u = new URL(value.trim())
    const host = u.hostname.replace(/^www\./, "")
    const tail = u.pathname.split("/").filter(Boolean).pop()
    if (!tail || tail.length > 24) return host
    return `${host}/${tail.length > 14 ? `${tail.slice(0, 13)}…` : tail}`
  } catch {
    return value
  }
}

/**
 * Trimmed, blanks dropped, duplicates collapsed to the first.
 *
 * The same URL twice on one task is never meaningful - it is a double paste -
 * and it used to reach React as two children with the same key. Collapsing them
 * here is what stops that happening rather than papering over it at render.
 *
 * Compared as exact strings after trimming, deliberately: query strings and
 * fragments distinguish real resources (a Google Sheet's `?gid=` is a different
 * tab), so normalising them away would merge links that are not the same.
 */
export function dedupeLinks(links: string[]): string[] {
  return [...new Set(links.map((l) => l.trim()).filter(Boolean))]
}
