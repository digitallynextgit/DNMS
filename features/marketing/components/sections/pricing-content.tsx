import Link from "next/link"
import type { ReactNode } from "react"
import {
  ArrowRight,
  Check,
  Minus,
  IndianRupee,
  Users,
  Layers,
  Receipt,
  LogOut,
  type LucideIcon,
} from "lucide-react"

import { siteConfig } from "@/config/site"
import { Button } from "@/components/ui/button"
import { PLANS, GST_RATE, type Plan } from "@/features/tenants"
import { BRAND_RED, demoHref } from "@/features/marketing/marketing.constants"
import { GridBackdrop, Reveal } from "../fx"

// Order shown to a visitor. Trial first because it is how everyone should start.
const SHOWN: Plan[] = [PLANS.TRIAL, PLANS.STARTER, PLANS.RED, PLANS.ENTERPRISE]

/** The tier the page pushes: the whole system, and what we run on ourselves. */
const FEATURED = PLANS.RED.key

const GST_PERCENT = Math.round(GST_RATE * 100)

/** The four facts a buyer asks about before they ask anything else. */
const NOTES: { icon: LucideIcon; title: string; body: ReactNode }[] = [
  {
    icon: Users,
    title: "Billed on active employees",
    body: "People who have left do not count. The number moves with your headcount rather than with the seats you bought last year.",
  },
  {
    icon: Layers,
    title: "Every plan is the whole product",
    body: "Tiers differ by module and headcount, not by hiding basics behind an upgrade. Security, permissions, audit logs and backups are in all of them.",
  },
  {
    icon: Receipt,
    title: "Prices exclude GST",
    // Derived from PLANS, not typed: a worked example that disagrees with the
    // cards above it is worse than no example at all.
    body: (
      <>
        Every figure above is in INR before tax. GST of {Math.round(GST_RATE * 100)}% is added at
        invoicing, so a ₹{PLANS.STARTER.pricePerEmployee} seat is billed at ₹
        {Math.round((PLANS.STARTER.pricePerEmployee ?? 0) * (1 + GST_RATE))}.
      </>
    ),
  },
  {
    icon: LogOut,
    title: "Cancel whenever",
    body: (
      <>
        No lock-in and no exit fee. Your data stays exportable for 30 days after you stop. See the{" "}
        <Link href="/legal/refund" className="text-foreground underline underline-offset-4">
          refund policy
        </Link>
        .
      </>
    ),
  },
]

/**
 * Listed prices exclude GST, so every PAID tier carries the rate beside the
 * figure. Free and negotiated tiers do not: "+ 18% GST" next to "Free" is
 * nonsense, and next to "Let's talk" it pre-empts a conversation.
 */
function priceLabel(plan: Plan): { amount: string; unit: string | null; taxed: boolean } {
  if (plan.pricePerEmployee === null) return { amount: "Let's talk", unit: null, taxed: false }
  if (plan.pricePerEmployee === 0) return { amount: "Free", unit: "for 21 days", taxed: false }
  return {
    amount: `₹${plan.pricePerEmployee}`,
    unit: "per employee / month",
    taxed: true,
  }
}

/**
 * Pricing page.
 *
 * Reads PLANS from the tenants feature rather than restating the numbers, so
 * the page cannot advertise a price or a headcount ceiling that differs from
 * what signup provisions and what the enforcement check actually applies. A
 * marketing page quoting a limit the product does not have is a support ticket
 * waiting to happen.
 */
export function PricingContent() {
  return (
    <div className="relative">
      <GridBackdrop />

      <div className="relative mx-auto max-w-[1600px] px-4 pt-28 pb-24 sm:px-6 lg:pt-32">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <Reveal>
          <span className="border-border/70 bg-card/70 inline-flex items-center gap-2.5 rounded-[6px] border py-1 pr-3 pl-1 text-xs">
            <span
              className="inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-1 text-[11px] font-semibold"
              style={{ backgroundColor: "rgba(239,68,68,0.12)", color: BRAND_RED }}
            >
              <IndianRupee className="h-3 w-3" />
              Pricing
            </span>
            <span className="text-muted-foreground">per employee, per month</span>
          </span>
        </Reveal>

        {/* Title left, supporting line right, both starting on the same line -
            the same header treatment as About and Contact. */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start lg:gap-16 xl:gap-24">
          <Reveal>
            {/* Two explicit lines rather than text-balance: where this heading
                breaks is a composition decision, not something to leave to the
                width of the column. */}
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              <span className="block">Pay for the people you</span>
              <span className="block" style={{ color: BRAND_RED }}>
                actually have.
              </span>
            </h1>
          </Reveal>
          <Reveal delay={100}>
            <p className="text-muted-foreground text-lg text-pretty">
              What DNMS does scales with headcount and nothing else, so that is what it costs
              against. No setup fee, no per-module upsell, no card to start.
            </p>
          </Reveal>
        </div>

        {/* ── Plans ──────────────────────────────────────────────────────── */}
        <div className="mt-16 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {SHOWN.map((plan, i) => {
            const featured = plan.key === FEATURED
            const { amount, unit, taxed } = priceLabel(plan)
            return (
              <Reveal key={plan.key} delay={Math.min(i * 80, 240)}>
                <div
                  className={`flex h-full flex-col rounded-[6px] border p-6 ${
                    featured ? "bg-card/70" : "border-border/70 bg-card/40"
                  }`}
                  style={featured ? { borderColor: BRAND_RED } : undefined}
                >
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold">{plan.name}</h2>
                    {featured && (
                      <span
                        className="rounded-[4px] px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase"
                        style={{ backgroundColor: "rgba(239,68,68,0.12)", color: BRAND_RED }}
                      >
                        Most complete
                      </span>
                    )}
                  </div>

                  <p className="text-muted-foreground mt-2 min-h-[2.5rem] text-sm leading-relaxed">
                    {plan.blurb}
                  </p>

                  <div className="mt-5">
                    {/* Baseline-aligned so the tax note sits on the price's
                        baseline rather than its cap height. */}
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-3xl font-bold tracking-tight">{amount}</span>
                      {taxed && (
                        <span className="text-muted-foreground text-xs font-medium">
                          + <span style={{ color: BRAND_RED }}>{GST_PERCENT}%</span> GST
                        </span>
                      )}
                    </div>
                    {unit && (
                      <span className="text-muted-foreground mt-1 block text-xs">{unit}</span>
                    )}
                  </div>

                  <div className="border-border/60 mt-5 border-t pt-5">
                    <ul className="space-y-2.5">
                      {plan.includes.map((item) => (
                        <li key={item} className="flex gap-2.5 text-sm">
                          <Check
                            className="mt-0.5 h-4 w-4 shrink-0"
                            style={{ color: BRAND_RED }}
                            aria-hidden
                          />
                          <span className="text-muted-foreground leading-snug">{item}</span>
                        </li>
                      ))}
                      {/* What a plan does NOT include, named rather than left to
                          be discovered after purchase. */}
                      {plan.excludes.map((item) => (
                        <li key={item} className="flex gap-2.5 text-sm">
                          <Minus
                            className="text-muted-foreground/50 mt-0.5 h-4 w-4 shrink-0"
                            aria-hidden
                          />
                          <span className="text-muted-foreground/60 leading-snug line-through">
                            {item}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-auto pt-6">
                    {plan.pricePerEmployee === null ? (
                      <Button asChild variant="outline" className="w-full">
                        <Link href="/contact">Talk to us</Link>
                      </Button>
                    ) : (
                      <Button asChild variant={featured ? "default" : "outline"} className="w-full">
                        <Link href="/signup">
                          {plan.key === "TRIAL" ? "Start free" : `Choose ${plan.name}`}
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              </Reveal>
            )
          })}
        </div>

        {/* ── Notes ──────────────────────────────────────────────────────────
            Four across at lg rather than a narrow two-up card. These are short,
            independent facts - a row of them scans in one pass, where a boxed
            column made the reader work down it. Each carries an icon so the
            block can be skimmed for the one that applies. */}
        <Reveal delay={120}>
          <div className="border-border/70 bg-card/40 mt-16 rounded-[6px] border p-6 sm:p-8 lg:p-10">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
              <h2 className="text-lg font-semibold">The small print, in plain words</h2>
              <p className="text-muted-foreground text-xs">
                No asterisks, and nothing that undoes the sentence before it.
              </p>
            </div>

            <dl className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-10">
              {NOTES.map(({ icon: Icon, title, body }) => (
                <div key={title}>
                  <span
                    className="inline-flex h-9 w-9 items-center justify-center rounded-[6px]"
                    style={{ backgroundColor: "rgba(239,68,68,0.12)" }}
                  >
                    <Icon className="h-4 w-4" style={{ color: BRAND_RED }} aria-hidden />
                  </span>
                  <dt className="mt-4 text-sm font-semibold">{title}</dt>
                  <dd className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Reveal>

        {/* ── CTA ────────────────────────────────────────────────────────────
            A full-width band, message left and actions right, rather than a
            centred column adrift in the page. At this width a centred CTA reads
            as an afterthought; a band reads as the end of an argument. */}
        <Reveal delay={180}>
          <div
            className="relative mt-8 overflow-hidden rounded-[6px] border p-8 sm:p-10 lg:p-12"
            style={{ borderColor: "rgba(239,68,68,0.35)" }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.06]"
              style={{
                background: `radial-gradient(70% 120% at 12% 50%, ${BRAND_RED} 0%, transparent 70%)`,
              }}
            />
            <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-16">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  Still working out which one?
                </h2>
                <p className="text-muted-foreground mt-3 max-w-2xl text-pretty">
                  Start on the trial: it unlocks everything for 21 days, so you can find out from
                  your own data rather than from this page.
                </p>
                <p className="text-muted-foreground mt-5 text-sm">
                  Questions about pricing?{" "}
                  <a
                    href={`mailto:${siteConfig.emails.sales}`}
                    className="text-foreground underline underline-offset-4"
                  >
                    {siteConfig.emails.sales}
                  </a>
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row lg:shrink-0">
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
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  )
}
