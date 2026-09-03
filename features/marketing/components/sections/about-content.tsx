import Link from "next/link"
import { ArrowRight, Building2, Compass, Layers, Lock, Users } from "lucide-react"

import { siteConfig } from "@/config/site"
import { Button } from "@/components/ui/button"
import { BRAND_RED, MODULES, demoHref } from "@/features/marketing/marketing.constants"
import { GridBackdrop, Reveal } from "../fx"

const PRINCIPLES = [
  {
    icon: Layers,
    title: "One system of record",
    text: "Attendance, leave, payroll, projects and hiring are the same people and the same hours seen from different angles. Split across five tools they disagree with each other, and someone spends their week reconciling spreadsheets. Held in one place they simply agree.",
  },
  {
    icon: Lock,
    title: "Permissions before features",
    text: "A payroll figure in the wrong hands is worse than a payroll figure nobody can see. Every module is built behind granular permission scopes, every administrative action is audited, and each company's data is isolated at the database layer rather than by convention.",
  },
  {
    icon: Compass,
    title: "Built from real operations",
    text: "DNMS grew out of running an agency: the biometric terminal at the door, the leave policy nobody could find, the client asking for a status update. Every module exists because the problem it solves was a real Tuesday afternoon, not a competitor's feature list.",
  },
]

/** About page body. Static content, so a plain server component. */
export function AboutContent() {
  return (
    <div className="relative">
      <GridBackdrop />

      <div className="relative mx-auto max-w-[1600px] px-4 pt-28 pb-8 sm:px-6 lg:pt-32">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <Reveal>
          <span className="border-border/70 bg-card/70 inline-flex items-center gap-2.5 rounded-sm border py-1 pr-3 pl-1 text-xs">
            <span
              className="inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-[11px] font-semibold"
              style={{ backgroundColor: "rgba(239,68,68,0.12)", color: BRAND_RED }}
            >
              <Building2 className="h-3 w-3" />
              About
            </span>
            <span className="text-muted-foreground">who builds {siteConfig.name}</span>
          </span>
        </Reveal>

        {/* Title left, standfirst right.
            ── TOP-ALIGNED ──
            Neither `items-end` nor `items-center` works when the two blocks are
            different heights: bottom alignment pushes the shorter block up above
            the title, centring straddles it. Starting them on the same line is
            the only rule that holds however the copy wraps.

            The columns are sized around line one of the heading: 35 characters,
            which needs roughly 900px at this size to stay on one line. The right
            column takes 0.65fr so the paragraph settles at three lines rather
            than four, which keeps the two blocks close in height. */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)] lg:items-start lg:gap-12 xl:gap-16">
          <Reveal delay={60}>
            {/* Two explicit lines, not text-balance: the red phrase earns its
                own line, and where it breaks should not depend on the viewport. */}
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl xl:text-[3.25rem]">
              <span className="block">Software for the parts of a company</span>
              <span className="block" style={{ color: BRAND_RED }}>
                nobody enjoys running.
              </span>
            </h1>
          </Reveal>

          <Reveal delay={120}>
            <p className="text-muted-foreground text-lg text-pretty">
              {siteConfig.fullName} is built by {siteConfig.legal.entity}, a digital agency that got
              tired of running its own operations across a dozen disconnected tools and built the
              thing it wanted instead.
            </p>
          </Reveal>
        </div>
      </div>

      {/* ── Story ──────────────────────────────────────────────────────── */}
      <div className="relative mx-auto max-w-[1600px] px-4 py-12 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.6fr)_minmax(0,1.4fr)] lg:gap-16 xl:gap-24">
          <Reveal>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              It started as an internal tool
            </h2>
          </Reveal>
          <Reveal delay={100}>
            <div className="max-w-[76ch] space-y-4">
              <p className="text-muted-foreground leading-relaxed">
                We were an agency with a biometric terminal at the door, leave requests arriving
                over chat, payroll in a spreadsheet, projects in one tracker, client updates in
                another, and a recurring argument about which number was correct.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                None of the individual tools were bad. The problem was the gaps between them: the
                same employee existing five times with five slightly different records, and a person
                whose actual job had quietly become copying data from one system into another.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                So we built one system where an employee is a single record, an hour worked is a
                single fact, and every module reads the same truth. We ran our own company on it
                first. {siteConfig.name} is that system, opened up for other companies with the same
                problem.
              </p>
            </div>
          </Reveal>
        </div>
      </div>

      {/* ── Principles ─────────────────────────────────────────────────── */}
      <div className="relative mx-auto max-w-[1600px] px-4 py-12 sm:px-6">
        <Reveal>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">What we hold to</h2>
        </Reveal>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {PRINCIPLES.map(({ icon: Icon, title, text }, i) => (
            <Reveal key={title} delay={100 + i * 80}>
              <div className="border-border/70 bg-card/50 h-full rounded-sm border p-6">
                <span
                  className="inline-flex h-9 w-9 items-center justify-center rounded-sm"
                  style={{ backgroundColor: "rgba(239,68,68,0.12)" }}
                >
                  <Icon className="h-4.5 w-4.5" style={{ color: BRAND_RED }} />
                </span>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>

      {/* ── What's in it ───────────────────────────────────────────────── */}
      <div className="relative mx-auto max-w-[1600px] px-4 py-12 sm:px-6">
        <Reveal>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {MODULES.length} modules, one login
          </h2>
          <p className="text-muted-foreground mt-3 max-w-2xl">
            Each one is a product in its own right. Together they are a company.
          </p>
        </Reveal>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {MODULES.map((m, i) => (
            <Reveal key={m.name} delay={Math.min(60 + i * 40, 320)}>
              <div className="border-border/70 bg-card/50 flex h-full items-start gap-3 rounded-sm border p-4">
                <m.icon className="mt-0.5 h-4.5 w-4.5 shrink-0" style={{ color: BRAND_RED }} />
                <div>
                  <p className="text-sm font-semibold">{m.name}</p>
                  <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{m.text}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>

      {/* ── Company facts ──────────────────────────────────────────────── */}
      <div className="relative mx-auto max-w-[1600px] px-4 py-12 sm:px-6">
        <Reveal>
          <div className="border-border/70 bg-card/50 rounded-sm border p-6 sm:p-8">
            <h2 className="flex items-center gap-2.5 text-lg font-semibold">
              <Users className="h-4.5 w-4.5" style={{ color: BRAND_RED }} />
              The company behind it
            </h2>
            <dl className="mt-6 grid gap-x-10 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-muted-foreground text-xs tracking-wide uppercase">
                  Operated by
                </dt>
                <dd className="mt-1 text-sm font-medium">{siteConfig.legal.entity}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs tracking-wide uppercase">Based in</dt>
                <dd className="mt-1 text-sm font-medium">{siteConfig.legal.address}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs tracking-wide uppercase">Product</dt>
                <dd className="mt-1 text-sm font-medium">{siteConfig.fullName}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs tracking-wide uppercase">
                  Get in touch
                </dt>
                <dd className="mt-1 text-sm font-medium">
                  <Link href="/contact" className="underline underline-offset-4">
                    Contact us
                  </Link>
                </dd>
              </div>
            </dl>
          </div>
        </Reveal>
      </div>

      {/* ── CTA ────────────────────────────────────────────────────────── */}
      <div className="relative mx-auto max-w-[1600px] px-4 pt-6 pb-20 text-center sm:px-6">
        <Reveal>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Run your company on it too
          </h2>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/signup">
                Start free
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href={demoHref}>Book a demo</a>
            </Button>
          </div>
        </Reveal>
      </div>
    </div>
  )
}
