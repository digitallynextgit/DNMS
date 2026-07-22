"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Renders the small markdown subset our AI replies use - **bold**, *italic*,
 * `code`, "- " bullets and blank-line paragraphs.
 *
 * Everything is built as real React elements (never dangerouslySetInnerHTML), so
 * nothing inside a model reply can inject markup.
 */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  // Order matters: **bold** must be tried before *italic*.
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*|_[^_\n]+_)/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    const tok = m[0]
    if (tok.startsWith("**")) {
      nodes.push(<strong key={`${keyPrefix}-b${i}`}>{tok.slice(2, -2)}</strong>)
    } else if (tok.startsWith("`")) {
      nodes.push(
        <code key={`${keyPrefix}-c${i}`} className="bg-muted rounded px-1 py-0.5 text-[0.85em]">
          {tok.slice(1, -1)}
        </code>,
      )
    } else {
      nodes.push(<em key={`${keyPrefix}-i${i}`}>{tok.slice(1, -1)}</em>)
    }
    last = m.index + tok.length
    i++
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

export function MarkdownLite({ content, className }: { content: string; className?: string }) {
  const blocks: React.ReactNode[] = []
  let bullets: string[] = []
  let key = 0

  const flush = () => {
    if (bullets.length === 0) return
    const items = bullets
    const k = key++
    blocks.push(
      <ul key={`ul${k}`} className="ml-4 list-disc space-y-1">
        {items.map((li, i) => (
          <li key={i}>{renderInline(li, `ul${k}-${i}`)}</li>
        ))}
      </ul>,
    )
    bullets = []
  }

  for (const raw of content.split("\n")) {
    const line = raw.trimEnd()
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line)
    if (bullet) {
      bullets.push(bullet[1] ?? "")
      continue
    }
    flush()
    if (!line.trim()) continue // blank line = block break (space-y handles the gap)
    const k = key++
    blocks.push(<p key={`p${k}`}>{renderInline(line, `p${k}`)}</p>)
  }
  flush()

  return <div className={cn("space-y-2", className)}>{blocks}</div>
}
