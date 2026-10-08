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

/** Falls back to initials when there's no logo or it fails to load (e.g. an expired signed URL). */
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
  const [prevSrc, setPrevSrc] = React.useState(src)
  if (src !== prevSrc) {
    setPrevSrc(src)
    setFailed(false)
  }

  const hasLogo = !!src && !failed

  return (
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden",
        // Only the initials fallback gets a tile; a real logo has its own shape.
        !hasLogo && "bg-muted rounded-sm border",
        className,
      )}
    >
      {hasLogo ? (
        // Our own route 302s to a short-lived signed B2 URL, so a plain <img>.
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
