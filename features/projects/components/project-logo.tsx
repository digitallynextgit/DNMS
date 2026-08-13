"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/** Initials from a project name: "RUDIONE / LEOCYM" -> "RL", "DNMS" -> "DN". */
function initials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s/]/gu, " ")
    .split(/[\s/]+/)
    .filter(Boolean)
  if (words.length === 0) return "?"
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase()
  return (words[0]![0]! + words[1]![0]!).toUpperCase()
}

/**
 * A project's logo, with an initials tile as the fallback.
 *
 * The fallback is not decoration - most projects have no logo yet, and an empty
 * box on every card would read as broken. `onError` also falls back, so a logo
 * whose signed URL has expired or whose object went missing degrades to initials
 * rather than a broken-image icon.
 */
export function ProjectLogo({
  src,
  name,
  className,
}: {
  src?: string | null
  name: string
  className?: string
}) {
  const [failed, setFailed] = React.useState(false)

  // A new src (?v= changes on every upload) deserves a fresh attempt.
  React.useEffect(() => setFailed(false), [src])

  const hasLogo = !!src && !failed

  return (
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden",
        // Chrome belongs to the FALLBACK only. A real logo carries its own shape
        // and edges, so a tile behind it just boxes it in; the tile exists to
        // give the initials something to sit on.
        !hasLogo && "bg-muted rounded-[2px] border",
        className,
      )}
    >
      {hasLogo ? (
        // The src is our own route, which 302s to a short-lived signed B2 URL -
        // not a static asset, so a plain <img> rather than next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-contain"
        />
      ) : (
        <span className="text-muted-foreground text-[11px] font-semibold tracking-wide">
          {initials(name)}
        </span>
      )}
    </div>
  )
}
