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
 * Sticky rail marking the section being read (legal pages and FAQ). The accent is a prop so this
 * client bundle doesn't pull in marketing.constants. A null-root IntersectionObserver still works
 * inside the marketing layout's own scroller.
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
  // Set on click so the highlight lands at once; the observer is ignored until scrolling settles.
  const pinnedUntil = useRef(0)

  // `items` is rebuilt every render, so key the effect on the anchors; read the order from a ref.
  const anchorKey = items.map((i) => i.anchor).join("|")
  const anchorsRef = useRef<string[]>([])
  useEffect(() => {
    anchorsRef.current = items.map((i) => i.anchor)
  })

  useEffect(() => {
    const anchors = anchorsRef.current
    const elements = anchors
      .map((a) => document.getElementById(a))
      .filter((el): el is HTMLElement => el !== null)
    if (elements.length === 0) return

    // Kept across callbacks: each callback only reports sections whose state changed.
    const visible = new Set<string>()

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id)
          else visible.delete(entry.target.id)
        }
        if (Date.now() < pinnedUntil.current) return
        // Highest visible section wins, so scrolling up promotes the section you're entering.
        const first = anchors.find((a) => visible.has(a))
        if (first) setActive(first)
      },
      {
        // A band just under the 64px header; a section counts once its heading nears the top.
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
                  // Lets smooth scrolling settle, so the highlight doesn't flicker down the list.
                  pinnedUntil.current = Date.now() + 800
                }}
                // -ml-px puts the 2px marker over the list's 1px rule.
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
