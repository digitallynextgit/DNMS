"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"

export interface SectionNavItem {
  /** The `id` of the section this entry points at. */
  anchor: string
  label: string
  /** Optional second line, e.g. "5 questions". */
  meta?: string
}

/**
 * A sticky rail that marks the section you are reading.
 *
 * Shared by the legal documents ("On this page") and the FAQ ("Topics"). It was
 * written for the legal pages first; generalising it when the FAQ needed the
 * same behaviour was cheaper than maintaining two copies of the observer logic
 * below, which has four separate details that are easy to get subtly wrong.
 *
 * The accent colour arrives as a prop rather than being imported: BRAND_RED
 * lives in marketing.constants, which pulls in the icon set and the module
 * catalogue, and none of that belongs in a client bundle for a list of links.
 *
 * SCROLL CONTAINER: the marketing layout gives itself its own scroller
 * (h-dvh + overflow-y-auto) rather than scrolling the document. That is fine
 * here - an IntersectionObserver with a null root still accounts for clipping
 * by an ancestor with overflow, so sections scrolled out of that div correctly
 * report as not intersecting.
 */
export function SectionNav({
  heading,
  items,
  accent,
  children,
}: {
  heading: string
  items: SectionNavItem[]
  accent: string
  /** Rendered under the list, inside the same sticky rail. */
  children?: ReactNode
}) {
  const [active, setActive] = useState<string>(items[0]?.anchor ?? "")
  // Set by a click so the highlight lands immediately instead of waiting for
  // smooth scrolling to arrive; the observer is ignored until it does.
  const pinnedUntil = useRef(0)

  // Callers build `items` inline with .map(), so its identity changes on every
  // render of the parent. Depending on the array directly would tear the
  // observer down and rebuild it each time - harmless from a server parent,
  // which never re-renders, but a thrash waiting to happen the first time this
  // is used from a client one. Key the effect on the anchors instead, and read
  // the current order from a ref.
  const anchorKey = items.map((i) => i.anchor).join("|")
  const anchorsRef = useRef<string[]>([])
  anchorsRef.current = items.map((i) => i.anchor)

  useEffect(() => {
    const anchors = anchorsRef.current
    const elements = anchors
      .map((a) => document.getElementById(a))
      .filter((el): el is HTMLElement => el !== null)
    if (elements.length === 0) return

    // Which sections are currently in the reading band. Kept across callbacks:
    // a callback only reports sections whose state CHANGED, so deciding from
    // `entries` alone would forget sections that were already visible.
    const visible = new Set<string>()

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id)
          else visible.delete(entry.target.id)
        }
        if (Date.now() < pinnedUntil.current) return
        // Highest section still in the band wins, so scrolling up promotes the
        // section you are moving into rather than the one you are leaving.
        const first = anchors.find((a) => visible.has(a))
        if (first) setActive(first)
      },
      {
        // A band just under the fixed 64px header. Cutting 60% off the bottom
        // means a section counts as "being read" only once its heading is near
        // the top of the screen - without it, a tall section three screens down
        // would light up the moment its first pixel appeared.
        rootMargin: "-88px 0px -60% 0px",
        threshold: 0,
      },
    )

    for (const el of elements) observer.observe(el)
    return () => observer.disconnect()
  }, [anchorKey])

  return (
    <nav aria-label={heading} className="lg:sticky lg:top-28 lg:self-start">
      <h2 className="text-foreground text-xs font-semibold tracking-wide uppercase">{heading}</h2>
      <ul className="border-border/60 mt-4 space-y-1.5 border-l">
        {items.map((item) => {
          const current = item.anchor === active
          return (
            <li key={item.anchor}>
              <a
                href={`#${item.anchor}`}
                aria-current={current ? "location" : undefined}
                onClick={() => {
                  setActive(item.anchor)
                  // Long enough for smooth scrolling to settle. Without this the
                  // observer fires for every section swept past on the way and
                  // the highlight flickers down the list before landing.
                  pinnedUntil.current = Date.now() + 800
                }}
                // -ml-px pulls the 2px marker over the list's 1px rule so the
                // active item replaces that segment instead of sitting beside it.
                className={`-ml-px block border-l-2 py-0.5 pl-3.5 transition-colors ${
                  current
                    ? "font-medium"
                    : "text-muted-foreground hover:text-foreground border-transparent"
                }`}
                style={current ? { borderColor: accent, color: accent } : undefined}
              >
                <span className="block text-sm leading-snug">{item.label}</span>
                {item.meta && <span className="mt-0.5 block text-xs opacity-70">{item.meta}</span>}
              </a>
            </li>
          )
        })}
      </ul>
      {children}
    </nav>
  )
}
