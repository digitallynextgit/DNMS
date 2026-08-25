import {
  Users,
  Fingerprint,
  Wallet,
  FolderKanban,
  Building2,
  Sparkles,
  type LucideIcon,
} from "lucide-react"

import { BorderBeam, DotBackdrop, Reveal } from "../fx"
import { BRAND_RED } from "@/features/marketing/marketing.constants"

interface NodeSpec {
  icon: LucideIcon
  label: string
  /** Position as a % of the diagram box - shared by the pill AND its line end,
   *  so the line always reaches the pill (they use the same coordinate space). */
  x: number
  y: number
}

const NODES: NodeSpec[] = [
  { icon: Building2, label: "Clients", x: 50, y: 8 },
  { icon: Users, label: "People", x: 9, y: 40 },
  { icon: Fingerprint, label: "Attendance", x: 91, y: 40 },
  { icon: Wallet, label: "Payroll", x: 22, y: 92 },
  { icon: FolderKanban, label: "Projects", x: 78, y: 92 },
]

/** Central hub + connecting lines + module chips, all built in divs/SVG. */
function ConnectedNodes() {
  return (
    <div className="relative mx-auto mt-14 h-[18rem] w-full max-w-[1400px] sm:mt-20 sm:h-[28rem]">
      {/* Below sm the whole diagram scales down uniformly so the pills never
          overflow, while the connector lines + pills stay perfectly aligned. */}
      <div className="absolute inset-0 origin-center scale-[0.68] sm:scale-100">
        {/* Subtle tech texture */}
        <DotBackdrop className="opacity-60" />

        {/* Dotted connector lines that flow continuously (seamless loop). NO
          viewBox → percentage coords resolve to real pixels, so the dotted
          pattern stays uniform and the offset loop never jumps. x/y percentages
          match each pill's left%/top%. */}
        <svg aria-hidden className="text-muted-foreground/60 absolute inset-0 h-full w-full">
          {NODES.map((n) => (
            <line
              key={n.label}
              x1="50%"
              y1="50%"
              x2={`${n.x}%`}
              y2={`${n.y}%`}
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray="10 8"
              strokeLinecap="round"
              className="animate-dnms-line"
            />
          ))}
        </svg>

        {/* Central DNMS hub - logo mark + moving gradient beam + a soft radar pulse. */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <span
            aria-hidden
            className="border-primary/25 animate-dnms-pulse-ring absolute inset-0 rounded-[6px] border"
          />
          <div className="border-border bg-card relative flex h-28 w-28 flex-col items-center justify-center gap-1.5 overflow-hidden rounded-[6px] border shadow-2xl">
            <BorderBeam />
            {/* 72px source for a 36px slot (2x retina) - the full-size
                brand-mark.png is 2505x2200 / 729 KB on a public landing page. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand-mark-72.png"
              alt="DNMS"
              width={36}
              height={36}
              loading="lazy"
              decoding="async"
              className="h-9 w-9 object-contain"
            />
            <span className="text-sm font-bold">DNMS</span>
          </div>
        </div>

        {/* Module chips - centered on their line's end point (static, so they stay
          connected to the line). */}
        {NODES.map((n) => (
          <div
            key={n.label}
            style={{ left: `${n.x}%`, top: `${n.y}%` }}
            className="border-border bg-card hover:border-primary/50 absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium whitespace-nowrap shadow-md transition-colors"
          >
            <span className="bg-primary/10 text-primary flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
              <n.icon className="h-3.5 w-3.5" />
            </span>
            {n.label}
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * The manifesto section: one database under people, work, money and clients —
 * not ten disconnected tabs.
 */
export function PlatformIntro() {
  return (
    <section id="platform" className="relative scroll-mt-20 pt-14 pb-20 sm:pt-16 sm:pb-24">
      <div className="relative mx-auto max-w-[1600px] px-4 sm:px-6">
        {/* Hero-style pill */}
        <Reveal>
          <span className="border-border/70 bg-card/70 inline-flex items-center gap-2.5 rounded-[6px] border py-1 pr-3 pl-1 text-xs">
            <span
              className="inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-1 text-[11px] font-semibold"
              style={{ backgroundColor: "rgba(239,68,68,0.12)", color: BRAND_RED }}
            >
              <Sparkles className="h-3 w-3" />
              One platform
            </span>
            <span className="text-muted-foreground">not ten tabs</span>
          </span>
        </Reveal>

        {/* Two columns, top-aligned: title (left) + supporting copy (right) */}
        <div className="mt-6 grid items-start gap-8 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <h2 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
              Stop running your company across{" "}
              <span style={{ color: BRAND_RED }}>disconnected tools</span>
            </h2>
          </Reveal>
          <Reveal delay={120}>
            <p className="text-muted-foreground text-lg text-pretty lg:text-xl">
              DNMS unifies people, work, money and clients over a single database. Attendance flows
              into payroll, projects into performance, and every module reads the same source of
              truth, so your headcount, hours and pay always reconcile, with nothing to stitch
              together by hand.
            </p>
          </Reveal>
        </div>

        <Reveal delay={200}>
          <ConnectedNodes />
        </Reveal>
      </div>
    </section>
  )
}
