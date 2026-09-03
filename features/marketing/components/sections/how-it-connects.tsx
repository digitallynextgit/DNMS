import { Sparkles } from "lucide-react"

import { HOW_STEPS, type FlowStep } from "../../marketing.constants"
import { DotBackdrop, Reveal } from "../fx"
import { BRAND_RED } from "@/features/marketing/marketing.constants"

// One-row nodes: every icon sits at cy=110 (viewBox 0 0 1200 240) at the column
// centres (150/450/750/1050). The connector waves up and down between them.
const FLOW_PATH =
  "M0,110 L150,110 C270,68 330,68 450,110 C570,152 630,152 750,110 C870,68 930,68 1050,110 L1200,110"

/** One milestone: a giant ghost number, an icon node on the curve, title + copy. */
function StepNode({ step, index }: { step: FlowStep; index: number }) {
  const Icon = step.icon
  return (
    <div className="relative flex flex-col items-center px-2 pt-[86px] text-center">
      <span
        aria-hidden
        className="text-foreground/[0.06] pointer-events-none absolute top-[38px] left-1/2 -translate-x-1/2 text-[9rem] leading-none font-bold select-none"
      >
        {index + 1}
      </span>
      <span className="border-border bg-card text-primary relative z-10 flex h-12 w-12 items-center justify-center rounded-full border shadow-md">
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="relative mt-4 text-base font-semibold tracking-tight">{step.title}</h3>
      <p className="text-muted-foreground relative mt-1.5 max-w-[13rem] text-sm text-pretty">
        {step.text}
      </p>
    </div>
  )
}

/** The connected chain that makes DNMS one system, not point tools. */
export function HowItConnects() {
  return (
    <section
      id="how"
      className="border-border/60 bg-muted/20 relative scroll-mt-20 overflow-hidden border-y py-20 sm:py-24"
    >
      <DotBackdrop />
      <div className="relative mx-auto max-w-[1600px] px-4 sm:px-6">
        {/* Hero-style pill */}
        <Reveal>
          <span className="border-border/70 bg-card/70 inline-flex items-center gap-2.5 rounded-sm border py-1 pr-3 pl-1 text-xs">
            <span
              className="inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-[11px] font-semibold"
              style={{ backgroundColor: "rgba(239,68,68,0.12)", color: BRAND_RED }}
            >
              <Sparkles className="h-3 w-3" />
              One chain
            </span>
            <span className="text-muted-foreground">not four apps</span>
          </span>
        </Reveal>

        {/* Two columns, top-aligned: title (left) + supporting copy (right) */}
        <div className="mt-6 grid items-start gap-8 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <h2 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
              One record flows through{" "}
              <span className="block" style={{ color: BRAND_RED }}>
                the whole company
              </span>
            </h2>
          </Reveal>
          <Reveal delay={120}>
            <p className="text-muted-foreground text-lg text-pretty lg:text-xl">
              A single biometric punch becomes attendance, adjusts for leave, computes payroll and
              feeds performance - one chain over one database, not four apps you reconcile by hand.
            </p>
          </Reveal>
        </div>

        {/* Desktop: staggered nodes riding a flowing gradient curve */}
        <div className="relative mt-16 hidden h-[240px] lg:block">
          <svg
            aria-hidden
            viewBox="0 0 1200 240"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
          >
            <defs>
              <linearGradient id="how-flow" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0" />
                <stop offset="14%" stopColor="#3b82f6" />
                <stop offset="86%" stopColor="#ef4444" />
                <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* dim base line */}
            <path
              d={FLOW_PATH}
              fill="none"
              stroke="url(#how-flow)"
              strokeWidth="2"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              opacity="0.4"
            />
            {/* colour flowing along the line, looping */}
            <path
              d={FLOW_PATH}
              pathLength={1000}
              fill="none"
              stroke="url(#how-flow)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="130 870"
              vectorEffect="non-scaling-stroke"
              className="animate-dnms-flow-line"
              style={{ filter: "drop-shadow(0 0 5px rgba(239,68,68,0.35))" }}
            />
          </svg>
          <div className="relative grid grid-cols-4">
            {HOW_STEPS.map((step, i) => (
              <Reveal key={step.title} delay={i * 110}>
                <StepNode step={step} index={i} />
              </Reveal>
            ))}
          </div>
        </div>

        {/* Mobile: vertical timeline */}
        <div className="mt-12 lg:hidden">
          {HOW_STEPS.map((step, i) => {
            const Icon = step.icon
            return (
              <div key={step.title} className="relative flex gap-4 pb-8 last:pb-0">
                {i < HOW_STEPS.length - 1 && (
                  <span
                    aria-hidden
                    className="absolute top-12 bottom-0 left-6 w-px -translate-x-1/2 bg-gradient-to-b from-blue-500/40 to-red-500/40"
                  />
                )}
                <span className="border-border bg-card text-primary relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border shadow-sm">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="pt-1.5">
                  <h3 className="text-base font-semibold tracking-tight">{step.title}</h3>
                  <p className="text-muted-foreground mt-1 text-sm text-pretty">{step.text}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
