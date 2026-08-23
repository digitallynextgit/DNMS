import { Quote } from "lucide-react"

import { PHILOSOPHY } from "../../marketing.constants"
import { DotBackdrop, Reveal } from "../fx"

// Brand red (matches the hero accent + the logo mark).
const BRAND_RED = "#ef4444"

/** Centered pull-quote - the product philosophy. No CTAs. */
export function Philosophy() {
  return (
    <section className="relative overflow-hidden py-24 sm:py-28">
      <DotBackdrop className="opacity-60" />
      <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
        <Reveal>
          <span className="bg-primary/10 text-primary mx-auto flex h-12 w-12 items-center justify-center rounded-full">
            <Quote className="h-6 w-6" />
          </span>
        </Reveal>
        <Reveal delay={100}>
          <blockquote className="mt-8 text-2xl font-semibold tracking-tight text-balance sm:text-4xl">
            &ldquo;{PHILOSOPHY.quote}&rdquo;
          </blockquote>
        </Reveal>
        <Reveal delay={200}>
          <div className="mt-6 text-sm font-medium">
            <span className="text-muted-foreground">- </span>
            <span style={{ color: BRAND_RED }}>{PHILOSOPHY.author}</span>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
