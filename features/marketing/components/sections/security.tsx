import { Check, Sparkles } from "lucide-react"

import { MODULES, SECURITY_POINTS } from "../../marketing.constants"
import { GridBackdrop, Reveal } from "../fx"

// Brand red (matches the hero accent + the logo mark).
const BRAND_RED = "#ef4444"

const governance = MODULES.find((x) => x.name === "Governance & Control")!

/** Security & governance: narrative + control cards, theme-aware to match the
 *  rest of the page. */
export function SecuritySection() {
  // Rendered for real in the left column, and as an invisible spacer above the
  // right cards so they start at the TITLE line (not the pill).
  const pill = (
    <span className="border-border/70 bg-card/70 inline-flex items-center gap-2.5 rounded-[6px] border py-1 pr-3 pl-1 text-xs">
      <span
        className="inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-1 text-[11px] font-semibold"
        style={{ backgroundColor: "rgba(239,68,68,0.12)", color: BRAND_RED }}
      >
        <Sparkles className="h-3 w-3" />
        Security
      </span>
      <span className="text-muted-foreground">&amp; governance</span>
    </span>
  )

  return (
    <section
      id="security"
      className="border-border/60 bg-muted/20 relative scroll-mt-20 overflow-hidden border-y py-20 sm:py-24"
    >
      <GridBackdrop className="opacity-50" />

      <div className="relative mx-auto grid max-w-[1600px] items-stretch gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16">
        {/* Left — narrative */}
        <Reveal>
          {pill}
          <h2 className="mt-6 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            Built for companies that <span style={{ color: BRAND_RED }}>care who can do what</span>
          </h2>
          <p className="text-muted-foreground mt-4 text-lg text-pretty lg:text-xl">
            {governance.text} Every request is permission-checked, every action is written to a
            tamper-evident trail, and secrets never leave the server in the clear.
          </p>
          <ul className="mt-8 space-y-3">
            {governance.points.map((p) => (
              <li key={p} className="flex gap-3 text-sm">
                <span className="bg-primary/10 text-primary mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full">
                  <Check className="h-3 w-3" />
                </span>
                <span className="text-muted-foreground">{p}</span>
              </li>
            ))}
          </ul>
        </Reveal>

        {/* Right — control cards, aligned to the title and filling the height */}
        <Reveal delay={120} className="lg:h-full">
          <div className="flex h-full flex-col">
            {/* invisible pill-height spacer (desktop) */}
            <div aria-hidden className="pointer-events-none hidden opacity-0 select-none lg:block">
              {pill}
            </div>
            <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2 sm:grid-rows-2 lg:mt-6">
              {SECURITY_POINTS.map((s) => (
                <div
                  key={s.title}
                  className="border-border bg-card/60 hover:border-border flex h-full flex-col rounded-[6px] border p-5 shadow-sm transition-colors"
                >
                  <span className="bg-primary/10 text-primary ring-border flex h-10 w-10 items-center justify-center rounded-[6px] ring-1">
                    <s.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-base font-semibold tracking-tight">{s.title}</h3>
                  <p className="text-muted-foreground mt-1.5 text-sm text-pretty">{s.text}</p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
