"use client"

/**
 * Interactive/animation primitives for the marketing landing page. All client
 * components (they use IntersectionObserver / pointer events), but their content
 * is still server-rendered into the initial HTML, so SEO is unaffected.
 *
 * Everything degrades gracefully with prefers-reduced-motion (handled in
 * globals.css) and touch devices (the cursor glow is pointer:fine only).
 */

import * as React from "react"
import { cn } from "@/lib/utils"

/** Fade + rise into view on scroll. Add `delay` (ms) to stagger siblings. */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [seen, setSeen] = React.useState(false)
  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setSeen(true)
          io.disconnect()
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div
      ref={ref}
      className={cn("dnms-reveal", seen && "is-in", className)}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  )
}

/** A soft primary glow that trails the cursor. Mounted once in the layout. */
export function SpotlightCursor() {
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (typeof window === "undefined") return
    if (!window.matchMedia("(pointer: fine)").matches) return
    const el = ref.current
    if (!el) return
    let raf = 0
    let x = window.innerWidth / 2
    let y = window.innerHeight / 2
    const onMove = (e: MouseEvent) => {
      x = e.clientX
      y = e.clientY
      if (!raf)
        raf = requestAnimationFrame(() => {
          el.style.left = `${x}px`
          el.style.top = `${y}px`
          raf = 0
        })
    }
    window.addEventListener("pointermove", onMove, { passive: true })
    return () => {
      window.removeEventListener("pointermove", onMove)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])
  return <div ref={ref} aria-hidden className="dnms-cursor-glow hidden md:block" />
}

/** Card wrapper with a pointer-following highlight + lift (see .dnms-spotlight). */
export function SpotlightCard({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`)
    el.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`)
  }
  return (
    <div ref={ref} onMouseMove={onMove} className={cn("dnms-spotlight", className)}>
      {children}
    </div>
  )
}

/** Counts up to `value` when scrolled into view. */
export function CountUp({
  value,
  suffix = "",
  prefix = "",
  duration = 1600,
  className,
}: {
  value: number
  suffix?: string
  prefix?: string
  duration?: number
  className?: string
}) {
  const ref = React.useRef<HTMLSpanElement>(null)
  const [n, setN] = React.useState(0)
  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return
        io.disconnect()
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          setN(value)
          return
        }
        const start = performance.now()
        const tick = (t: number) => {
          const p = Math.min(1, (t - start) / duration)
          // easeOutCubic
          setN(Math.round(value * (1 - Math.pow(1 - p, 3))))
          if (p < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      },
      { threshold: 0.4 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [value, duration])
  return (
    <span ref={ref} className={className}>
      {prefix}
      {n.toLocaleString()}
      {suffix}
    </span>
  )
}

/** Seamless infinite marquee. Duplicates children so the loop has no seam. */
export function Marquee({
  children,
  reverse = false,
  className,
}: {
  children: React.ReactNode
  reverse?: boolean
  className?: string
}) {
  return (
    <div className={cn("group flex overflow-hidden", className)}>
      <div
        className={cn(
          "flex shrink-0 items-center gap-4 pr-4",
          reverse ? "animate-dnms-marquee-rev" : "animate-dnms-marquee",
          "group-hover:pause",
        )}
      >
        {children}
        {children}
      </div>
    </div>
  )
}

/** Animated ambient aurora blobs - a reusable section background. */
export function Aurora({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
    >
      {/* Minimalist: two soft, low-opacity blobs (red + blue) - not a wall of glow. */}
      <div className="animate-dnms-aurora absolute -top-32 -left-24 h-[26rem] w-[26rem] rounded-full bg-red-500/12 blur-[120px]" />
      <div
        className="animate-dnms-aurora absolute -right-24 -bottom-32 h-[26rem] w-[26rem] rounded-full bg-blue-500/10 blur-[120px]"
        style={{ animationDelay: "-9s" }}
      />
    </div>
  )
}

/** Rotating red/blue border beam (Magic UI-style). Drop inside a `relative`,
 *  rounded-[6px], overflow-hidden container. CSS-driven via .dnms-border-beam. */
export function BorderBeam({ className }: { className?: string }) {
  return <span aria-hidden className={cn("dnms-border-beam", className)} />
}

/** Sweeping shine on text (Magic UI AnimatedShinyText). */
export function ShinyText({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <span className={cn("dnms-shiny-text", className)}>{children}</span>
}

/** Masked grid / dot backdrops. */
export function GridBackdrop({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("dnms-grid-bg pointer-events-none absolute inset-0", className)}
    />
  )
}
export function DotBackdrop({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("dnms-dot-bg pointer-events-none absolute inset-0", className)}
    />
  )
}
