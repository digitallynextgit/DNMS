// Pure: match a request path against Next.js-style route patterns
// ("/api/projects/[id]/tasks", "/api/x/[...slug]", "/api/y/[[...opt]]").
// Static segments beat dynamic ones, so /api/leave/team wins over
// /api/leave/[id]. No framework imports - unit-tested in route-match.test.ts.

export interface CompiledPattern<T> {
  value: T
  segments: string[]
  specificity: number
}

export function compilePatterns<T>(
  items: readonly T[],
  pathOf: (item: T) => string,
): CompiledPattern<T>[] {
  return items
    .map((value) => {
      const segments = pathOf(value).split("/").filter(Boolean)
      return { value, segments, specificity: segments.filter((s) => !s.startsWith("[")).length }
    })
    .sort((a, b) => b.specificity - a.specificity || b.segments.length - a.segments.length)
}

export function matchPattern<T>(
  compiled: readonly CompiledPattern<T>[],
  pathname: string,
): { value: T; params: Record<string, string | string[]> } | null {
  const parts = pathname.split("/").filter(Boolean).map(safeDecode)
  for (const route of compiled) {
    const params: Record<string, string | string[]> = {}
    let i = 0
    let matched = true
    for (const seg of route.segments) {
      const catchAll = seg.match(/^\[\[?\.\.\.(\w+)\]\]?$/)
      if (catchAll) {
        const rest = parts.slice(i)
        if (rest.length === 0 && !seg.startsWith("[[")) matched = false
        else params[catchAll[1]!] = rest
        i = parts.length
        break
      }
      const part = parts[i]
      if (part === undefined) {
        matched = false
        break
      }
      const dynamic = seg.match(/^\[(\w+)\]$/)
      if (dynamic) params[dynamic[1]!] = part
      else if (seg !== part) {
        matched = false
        break
      }
      i++
    }
    if (matched && i === parts.length) return { value: route.value, params }
  }
  return null
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}
