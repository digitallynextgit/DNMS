import * as React from "react"

/** Below this a query matches almost everything, so searching is not worth it. */
export const MIN_SEARCH_QUERY = 2

/** A window around the first match, so a deep hit is shown in context. */
export function snippet(text: string, query: string, pad = 40): string {
  const at = text.toLowerCase().indexOf(query.toLowerCase())
  if (at < 0) return text.length > 120 ? `${text.slice(0, 120)}…` : text
  const start = Math.max(0, at - pad)
  const end = Math.min(text.length, at + query.length + pad)
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`
}

export function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>

  const lower = text.toLowerCase()
  const needle = query.toLowerCase()
  const out: React.ReactNode[] = []
  let i = 0
  let n = 0
  for (;;) {
    const at = lower.indexOf(needle, i)
    if (at < 0) break
    if (at > i) out.push(text.slice(i, at))
    out.push(
      <mark key={n++} className="rounded-sm bg-amber-300/80 px-0.5 text-black">
        {text.slice(at, at + needle.length)}
      </mark>,
    )
    i = at + needle.length
  }
  out.push(text.slice(i))
  return <>{out}</>
}
