import { Check, X, Sparkles } from "lucide-react"

import { WHY_REASONS } from "../../marketing.constants"
import { Reveal } from "../fx"
import { BRAND_RED } from "@/features/marketing/marketing.constants"

// Mirrors WHY_REASONS one-for-one: the "bad" counterpart of each DNMS win, so
// both columns carry the same number of points with the same title + copy shape.
const PATCHWORK: { title: string; text: string }[] = [
  {
    title: "A tool for every job",
    text: "HR in one app, attendance in another, payroll in a spreadsheet and chat somewhere else, with none of them talking to each other.",
  },
  {
    title: "Numbers that never reconcile",
    text: "Headcount, hours and pay live in different files, so the totals rarely match and month-end becomes a manual hunt.",
  },
  {
    title: "Ad-hoc access, no trail",
    text: "Logins get shared, permissions are guesswork, and no one can say who changed what or when.",
  },
  {
    title: "Breaks as you grow",
    text: "Every new team, client or process means another tool, another export and another migration you dread.",
  },
]

/** Side-by-side contrast: the usual patchwork (red) vs. one connected platform (green). */
export function WhyDnms() {
  return (
    <section
      id="why"
      className="border-border/60 bg-muted/20 relative scroll-mt-20 border-y py-20 sm:py-24"
    >
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6">
        {/* Hero-style pill */}
        <Reveal>
          <span className="border-border/70 bg-card/70 inline-flex items-center gap-2.5 rounded-[6px] border py-1 pr-3 pl-1 text-xs">
            <span
              className="inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-1 text-[11px] font-semibold"
              style={{ backgroundColor: "rgba(239,68,68,0.12)", color: BRAND_RED }}
            >
              <Sparkles className="h-3 w-3" />
              Why DNMS
            </span>
            <span className="text-muted-foreground">not a patchwork</span>
          </span>
        </Reveal>

        {/* Two columns: title (left) + supporting copy (right) */}
        <div className="mt-6 grid items-start gap-8 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <h2 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
              Stop stitching <span style={{ color: BRAND_RED }}>tools together</span>
            </h2>
          </Reveal>
          <Reveal delay={120}>
            <p className="text-muted-foreground text-lg text-pretty lg:text-xl">
              The difference is not a longer feature list. It is one connected system where the
              numbers add up on their own.
            </p>
          </Reveal>
        </div>

        <div className="mt-14 grid items-stretch gap-6 lg:grid-cols-2">
          {/* The usual patchwork: red / error */}
          <Reveal>
            <div className="h-full rounded-[6px] border border-red-500/25 bg-red-500/[0.03] p-7">
              <h3 className="text-muted-foreground text-lg font-semibold tracking-tight">
                The usual patchwork
              </h3>
              <ul className="mt-6 space-y-5">
                {PATCHWORK.map((p) => (
                  <li key={p.title} className="flex gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-500">
                      <X className="h-3 w-3" />
                    </span>
                    <div>
                      <div className="text-sm font-semibold">{p.title}</div>
                      <p className="text-muted-foreground mt-1 text-sm text-pretty">{p.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          {/* With DNMS: green / ok */}
          <Reveal delay={120}>
            <div className="h-full rounded-[6px] border border-emerald-500/30 bg-emerald-500/[0.03] p-7 shadow-xl ring-1 ring-emerald-500/10">
              <h3 className="text-lg font-semibold tracking-tight">
                With <span className="text-emerald-500">DNMS</span>
              </h3>
              <ul className="mt-6 space-y-5">
                {WHY_REASONS.map((r) => (
                  <li key={r.title} className="flex gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                      <Check className="h-3 w-3" />
                    </span>
                    <div>
                      <div className="text-sm font-semibold">{r.title}</div>
                      <p className="text-muted-foreground mt-1 text-sm text-pretty">{r.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
