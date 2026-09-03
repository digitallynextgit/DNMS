import { Check, Sparkles } from "lucide-react"

import { MODULES, type MarketingModule } from "../../marketing.constants"
import { cn } from "@/lib/utils"
import { Reveal, SpotlightCard } from "../fx"
import { BRAND_RED } from "@/features/marketing/marketing.constants"

/**
 * Per-module column span on the lg 6-col grid. Every consecutive PAIR sums to 6,
 * so the ten cards tile into five clean rows of two (no stranded last cell). The
 * three cards carrying live mockups all land on the wide 2/3 (col-span-4) side.
 */
const COL_SPAN: Record<string, string> = {
  "HR & People": "lg:col-span-2",
  "Attendance & Time": "lg:col-span-4",
  "Leave & Remote Work": "lg:col-span-3",
  "Payroll & Performance": "lg:col-span-3",
  "Projects & Delivery": "lg:col-span-4",
  "Recruitment & Hiring": "lg:col-span-2",
  "Client Portal": "lg:col-span-3",
  "Comms & Culture": "lg:col-span-3",
  "SEO Suite": "lg:col-span-4",
  "Governance & Control": "lg:col-span-2",
}

/** Tiny live-attendance strip: a couple of stat chips + a sweep of bars. */
function AttendanceMock() {
  const bars: number[] = [48, 72, 60, 88, 66, 94, 78]
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-[auto_1fr]">
      <div className="flex gap-2 sm:flex-col">
        <div className="border-border bg-background rounded-sm border px-3 py-2">
          <div className="text-muted-foreground text-[10px] uppercase">Present</div>
          <div className="text-lg font-semibold tabular-nums">142</div>
        </div>
        <div className="border-border bg-background rounded-sm border px-3 py-2">
          <div className="text-muted-foreground text-[10px] uppercase">On leave</div>
          <div className="text-lg font-semibold tabular-nums">8</div>
        </div>
      </div>
      <div className="border-border bg-background relative overflow-hidden rounded-sm border p-3">
        <div className="text-muted-foreground mb-2 text-[10px] font-medium uppercase">
          Punches · this week
        </div>
        <div className="flex h-16 items-end gap-1.5" aria-hidden>
          {bars.map((h, i) => (
            <div
              key={i}
              className="from-primary/80 to-primary/25 flex-1 rounded-sm bg-gradient-to-t"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
        <div className="via-primary/70 animate-dnms-scan absolute inset-x-3 h-px bg-gradient-to-r from-transparent to-transparent" />
      </div>
    </div>
  )
}

/** Mini kanban board - three columns of stacked task chips. */
function ProjectsMock() {
  const cols: [string, number][] = [
    ["To do", 3],
    ["In progress", 2],
    ["Done", 4],
  ]
  return (
    <div className="mt-5 grid grid-cols-3 gap-2">
      {cols.map(([label, n], c) => (
        <div
          key={label}
          className="border-border bg-background overflow-hidden rounded-sm border p-2"
        >
          <div className="text-muted-foreground mb-2 flex items-center justify-between text-[10px] font-medium">
            <span className="truncate uppercase">{label}</span>
            <span className="bg-muted rounded-full px-1.5 tabular-nums">{n}</span>
          </div>
          <div className="space-y-1.5">
            {Array.from({ length: n }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "animate-dnms-bob-sm rounded-sm px-2 py-2",
                  c === 2 ? "bg-emerald-500/10" : c === 1 ? "bg-blue-500/10" : "bg-muted",
                )}
                style={{ animationDelay: `${-(c * 2 + i)}s` }}
              >
                <div className="bg-foreground/15 h-1.5 w-4/5 rounded-full" />
                <div className="bg-foreground/10 mt-1 h-1.5 w-1/2 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/** Mini SEO panel: a rising area line + a compact keyword ranking table. */
function SeoMock() {
  const rows: [string, string, string][] = [
    ["company os software", "#3", "+6"],
    ["hr payroll platform", "#7", "+2"],
    ["biometric attendance", "#5", "+4"],
  ]
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      <div className="border-border bg-background relative overflow-hidden rounded-sm border p-3">
        <div className="text-muted-foreground mb-2 text-[10px] font-medium uppercase">
          Avg. position
        </div>
        <svg viewBox="0 0 120 56" className="h-16 w-full" preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id="bento-seo-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M0 46 L20 40 L40 42 L60 28 L80 30 L100 16 L120 10 L120 56 L0 56 Z"
            fill="url(#bento-seo-fill)"
            className="text-primary"
          />
          <path
            d="M0 46 L20 40 L40 42 L60 28 L80 30 L100 16 L120 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-primary"
          />
        </svg>
      </div>
      <div className="border-border bg-background rounded-sm border p-2">
        <div className="text-muted-foreground mb-1.5 px-1 text-[10px] font-medium uppercase">
          Keywords
        </div>
        <div className="space-y-2">
          {rows.map(([kw, pos, delta]) => (
            <div key={kw} className="grid grid-cols-3 items-center gap-2">
              <span className="truncate text-[11px]">{kw}</span>
              <span className="text-muted-foreground text-center text-[11px] tabular-nums">
                {pos}
              </span>
              <span className="justify-self-end rounded-sm bg-emerald-500/10 px-1.5 py-0.5 text-sm font-semibold text-emerald-500 tabular-nums">
                {delta}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const MOCKS: Record<string, React.ReactNode> = {
  "Attendance & Time": <AttendanceMock />,
  "Projects & Delivery": <ProjectsMock />,
  "SEO Suite": <SeoMock />,
}

function ModuleCell({ m, index }: { m: MarketingModule; index: number }) {
  const Icon = m.icon
  const span = COL_SPAN[m.name]
  const mock = MOCKS[m.name]
  return (
    <Reveal delay={(index % 3) * 90} className={cn("h-full", span)}>
      <SpotlightCard className="border-border bg-card/60 flex h-full flex-col rounded-sm border p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-sm">
            <Icon className="h-5 w-5" />
          </span>
          <h3 className="text-base font-semibold tracking-tight">{m.name}</h3>
        </div>
        <p className="text-muted-foreground mt-3 text-sm text-pretty">{m.text}</p>
        {/* Flagship cards show a live mini-mockup; the rest fill with their
            real capability list so no card is left half-empty. */}
        {mock ?? (
          <ul className="mt-4 space-y-2.5">
            {m.points.map((p) => (
              <li
                key={p}
                className="text-muted-foreground flex items-start gap-2.5 text-[13px] leading-snug"
              >
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: BRAND_RED }} />
                <span className="text-pretty">{p}</span>
              </li>
            ))}
          </ul>
        )}
      </SpotlightCard>
    </Reveal>
  )
}

/** Bento grid of all ten modules - three flagship cells carry live mini-mockups. */
export function BentoOverview() {
  return (
    <section
      id="modules"
      className="border-border/60 bg-muted/20 relative scroll-mt-20 border-y py-20 sm:py-24"
    >
      <div className="relative mx-auto max-w-[1600px] px-4 sm:px-6">
        {/* Hero-style pill */}
        <Reveal>
          <span className="border-border/70 bg-card/70 inline-flex items-center gap-2.5 rounded-sm border py-1 pr-3 pl-1 text-xs">
            <span
              className="inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-[11px] font-semibold"
              style={{ backgroundColor: "rgba(239,68,68,0.12)", color: BRAND_RED }}
            >
              <Sparkles className="h-3 w-3" />
              Everything
            </span>
            <span className="text-muted-foreground">together</span>
          </span>
        </Reveal>

        {/* Two columns, top-aligned: title (left) + supporting copy (right) */}
        <div className="mt-6 grid items-start gap-8 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <h2 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
              Ten modules. <span style={{ color: BRAND_RED }}>One system.</span>
            </h2>
          </Reveal>
          <Reveal delay={120}>
            <p className="text-muted-foreground text-lg text-pretty lg:text-xl">
              Every part of how a company runs, sharing one database and one login, so the numbers
              always add up and nothing lives in a silo.
            </p>
          </Reveal>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {MODULES.map((m, i) => (
            <ModuleCell key={m.name} m={m} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
