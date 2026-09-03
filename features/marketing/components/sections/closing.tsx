import { Sparkles } from "lucide-react"

import { siteConfig } from "@/config/site"
import { GridBackdrop, Reveal } from "../fx"
import { NewsletterForm } from "../newsletter-form"
import { BRAND_RED } from "@/features/marketing/marketing.constants"

/** Final full-bleed band: closing statement + newsletter sign-up. */
export function Closing() {
  return (
    <section className="relative overflow-hidden py-24">
      <GridBackdrop />

      <div className="relative mx-auto max-w-[1600px] px-4 sm:px-6">
        {/* Hero-style pill */}
        <Reveal>
          <span className="border-border/70 bg-card/70 inline-flex items-center gap-2.5 rounded-sm border py-1 pr-3 pl-1 text-xs">
            <span
              className="inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-[11px] font-semibold"
              style={{ backgroundColor: "rgba(239,68,68,0.12)", color: BRAND_RED }}
            >
              <Sparkles className="h-3 w-3" />
              Newsletter
            </span>
            <span className="text-muted-foreground">stay in the loop</span>
          </span>
        </Reveal>

        <div className="mt-6 grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
          {/* Left: closing statement */}
          <Reveal>
            <h2 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
              Everything your company runs on.{" "}
              <span style={{ color: BRAND_RED }}>One platform.</span>
            </h2>
          </Reveal>

          {/* Right: copy + newsletter */}
          <Reveal delay={120}>
            <p className="text-muted-foreground text-lg text-pretty lg:text-xl">
              {siteConfig.description}
            </p>
            <p className="mt-6 text-sm font-semibold">Get product updates in your inbox.</p>
            <NewsletterForm className="mt-3 max-w-md" />
          </Reveal>
        </div>
      </div>
    </section>
  )
}
