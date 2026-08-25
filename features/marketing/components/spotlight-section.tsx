import { Check, Sparkles } from "lucide-react"

import { cn } from "@/lib/utils"
import { Reveal, SpotlightCard } from "./fx"
import { BRAND_RED } from "@/features/marketing/marketing.constants"

// The punchy tail of each module headline, painted brand red like the hero &
// bento titles. Keyed by the eyebrow, which is the module name each section passes.
const TITLE_ACCENT: Record<string, string> = {
  "HR & People": "one record",
  "Attendance & Time": "on autopilot",
  "Leave & Remote Work": "fully automated",
  "Payroll & Performance": "pays itself",
  "Projects & Delivery": "one place",
  "Recruitment & Hiring": "end to end",
  "Client Portal": "their own portal",
  "Comms & Culture": "your team connects",
  "SEO Suite": "on autopilot",
  "Governance & Control": "full visibility",
}

/**
 * Shared layout for a module "spotlight": a text column (eyebrow + title + copy +
 * checklist) beside a bespoke visual/mockup. `reverse` swaps the sides; `tinted`
 * gives an alternating banded background. Each module supplies its own `visual`.
 */
export function SpotlightSection({
  id,
  eyebrow,
  title,
  text,
  points,
  visual,
  reverse = false,
  tinted = false,
  titleBreak = false,
  bareVisual = false,
}: {
  id?: string
  eyebrow: string
  title: string
  text: string
  points: string[]
  visual: React.ReactNode
  reverse?: boolean
  tinted?: boolean
  /** Force the red accent phrase onto its own line (instead of flowing inline). */
  titleBreak?: boolean
  /** Render the visual without the outer card chrome (it supplies its own frame). */
  bareVisual?: boolean
}) {
  // Split the title so its brand-red accent phrase (if any) can be colored.
  const accent = TITLE_ACCENT[eyebrow]
  const accentAt = accent ? title.indexOf(accent) : -1

  // Hero-style pill (matches the platform + bento sections). Rendered twice: for
  // real in the text column, and as an invisible spacer above the visual so the
  // card top lines up with the TITLE rather than the pill.
  const pill = (
    <span className="border-border/70 bg-card/70 inline-flex items-center gap-2.5 rounded-[6px] border py-1 pr-3 pl-1 text-xs">
      <span
        className="inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-1 text-[11px] font-semibold"
        style={{ backgroundColor: "rgba(239,68,68,0.12)", color: BRAND_RED }}
      >
        <Sparkles className="h-3 w-3" />
        Module
      </span>
      <span className="text-muted-foreground">{eyebrow}</span>
    </span>
  )

  return (
    <section
      id={id}
      className={cn(
        "relative scroll-mt-20 py-20 sm:py-24",
        tinted && "border-border/60 bg-muted/20 border-y",
      )}
    >
      <div className="mx-auto grid max-w-[1600px] grid-cols-1 items-stretch gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16">
        <Reveal className={cn("min-w-0", reverse && "lg:order-2")}>
          {pill}
          <h2 className="mt-6 text-4xl font-bold tracking-tight text-pretty sm:text-5xl">
            {accentAt === -1 ? (
              title
            ) : (
              <>
                {title.slice(0, accentAt)}
                {/* Accent stays together on one line - it flows onto the same
                    line when it fits, otherwise wraps as a whole to the next. */}
                <span
                  className={cn("whitespace-nowrap", titleBreak && "block")}
                  style={{ color: BRAND_RED }}
                >
                  {accent}
                </span>
                {title.slice(accentAt + accent!.length)}
              </>
            )}
          </h2>
          <p className="text-muted-foreground mt-4 text-lg text-pretty lg:text-xl">{text}</p>
          <ul className="mt-6 space-y-3">
            {points.map((p) => (
              <li key={p} className="flex gap-3 text-sm">
                <span className="bg-primary/10 text-primary mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full">
                  <Check className="h-3 w-3" />
                </span>
                <span className="text-muted-foreground">{p}</span>
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={120} className={cn("h-full min-w-0", reverse && "lg:order-1")}>
          <div className="flex h-full min-w-0 flex-col">
            {/* Invisible pill-height spacer so the card's top lines up with the
                TITLE (not the pill) on desktop. Hidden on mobile where it stacks. */}
            <div aria-hidden className="pointer-events-none hidden opacity-0 select-none lg:block">
              {pill}
            </div>
            {bareVisual ? (
              // Visual brings its own frame - no outer card chrome.
              <div className="flex flex-1 flex-col lg:mt-6">{visual}</div>
            ) : (
              <SpotlightCard className="border-border bg-card/60 relative flex flex-1 flex-col justify-center overflow-hidden rounded-[6px] border p-3 shadow-xl sm:p-4 lg:mt-6">
                {visual}
              </SpotlightCard>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
