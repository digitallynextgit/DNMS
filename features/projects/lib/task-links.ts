/** http(s) only, checked on the PARSED url - a prefix check would pass "javascript:https://…". */
export function isSafeHttpUrl(value: string): boolean {
  try {
    const u = new URL(value.trim())
    return (u.protocol === "http:" || u.protocol === "https:") && !!u.hostname
  } catch {
    return false
  }
}

/** Grid label: host minus "www." plus a path hint, so several Google Docs are distinguishable. */
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
 * Trimmed, blanks dropped, duplicates collapsed (they would be duplicate React keys). Exact string
 * match on purpose: query strings like a Sheet's `?gid=` are different resources.
 */
export function dedupeLinks(links: string[]): string[] {
  return [...new Set(links.map((l) => l.trim()).filter(Boolean))]
}
