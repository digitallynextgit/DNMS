import { Sparkles } from "lucide-react"

import { BENEFITS } from "../../marketing.constants"
import { cn } from "@/lib/utils"
import { DotBackdrop, Reveal, SpotlightCard } from "../fx"
import { BRAND_RED } from "@/features/marketing/marketing.constants"

/** Outcome-led grid: what a company GETS, rendered as pointer-follow cards with
 *  alternating red/blue accents that light up on hover. */
export function Benefits() {
  return (
    <section id="benefits" className="relative scroll-mt-20 overflow-hidden py-20 sm:py-24">
      <DotBackdrop />

      <div className="relative mx-auto max-w-[1600px] px-4 sm:px-6">
        {/* Hero-style pill */}
        <Reveal>
          <span className="border-border/70 bg-card/70 inline-flex items-center gap-2.5 rounded-[6px] border py-1 pr-3 pl-1 text-xs">
            <span
              className="inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-1 text-[11px] font-semibold"
              style={{ backgroundColor: "rgba(239,68,68,0.12)", color: BRAND_RED }}
            >
              <Sparkles className="h-3 w-3" />
              Real outcomes
            </span>
            <span className="text-muted-foreground">not features</span>
          </span>
        </Reveal>

        {/* Two columns: title (left) + supporting copy (right) */}
        <div className="mt-6 grid items-start gap-8 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <h2 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
              The outcomes,{" "}
              <span className="block" style={{ color: BRAND_RED }}>
                not just the features
              </span>
            </h2>
          </Reveal>
          <Reveal delay={120}>
            <p className="text-muted-foreground text-lg text-pretty lg:text-xl">
              Every module earns its place by removing real work. Here is what changes for your
              company once the whole platform runs as one.
            </p>
          </Reveal>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((b, i) => {
            const Icon = b.icon
            const red = i % 2 === 0
            return (
              <Reveal key={b.title} delay={i * 90}>
                <SpotlightCard
                  className={cn(
                    "group border-border bg-card/60 relative flex h-full flex-col overflow-hidden rounded-[6px] border p-6 shadow-sm transition-all duration-300 hover:-translate-y-1",
                    red ? "hover:border-red-500/40" : "hover:border-blue-500/40",
                  )}
                >
                  {/* corner glow that blooms on hover */}
                  <span
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute -top-14 -right-14 h-36 w-36 rounded-full opacity-0 blur-3xl transition-opacity duration-300 group-hover:opacity-100",
                      red ? "bg-red-500/15" : "bg-blue-500/15",
                    )}
                  />
                  {/* big faint index */}
                  <span
                    aria-hidden
                    className="text-foreground/[0.05] pointer-events-none absolute right-0 -bottom-5 text-[6rem] leading-none font-bold select-none"
                  >
                    {i + 1}
                  </span>
                  <span className="bg-primary/10 text-primary ring-border relative flex h-12 w-12 items-center justify-center rounded-[6px] ring-1">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="relative mt-5 text-lg font-semibold tracking-tight">{b.title}</h3>
                  <p className="text-muted-foreground relative mt-2 text-sm text-pretty">
                    {b.text}
                  </p>
                </SpotlightCard>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
