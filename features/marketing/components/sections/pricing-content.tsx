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

import { siteConfig } from "@/lib/site"
import { Button } from "@/components/ui/button"
import { PLANS, GST_RATE, type Plan } from "@/features/tenants"
import { BRAND_RED, demoHref } from "@/features/marketing/marketing.constants"
import { GridBackdrop, Reveal } from "../fx"

// Order shown to a visitor. Trial first because it is how everyone should start.
const SHOWN: Plan[] = [PLANS.TRIAL, PLANS.STARTER, PLANS.RED, PLANS.ENTERPRISE]

/** The tier the page pushes: the whole system, and what we run on ourselves. */
const FEATURED = PLANS.RED.key

const GST_PERCENT = Math.round(GST_RATE * 100)

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
    // Derived from PLANS, so the example can't disagree with the cards.
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

/** Prices exclude GST, so paid tiers show the rate; free and "Let's talk" tiers don't. */
function priceLabel(plan: Plan): { amount: string; unit: string | null; taxed: boolean } {
  if (plan.pricePerEmployee === null) return { amount: "Let's talk", unit: null, taxed: false }
  if (plan.pricePerEmployee === 0) return { amount: "Free", unit: "for 21 days", taxed: false }
  return {
    amount: `₹${plan.pricePerEmployee}`,
    unit: "per employee / month",
    taxed: true,
  }
}

/** Pricing page. Reads PLANS from the tenants feature, so it matches what signup enforces. */
export function PricingContent() {
  return (
    <div className="relative">
      <GridBackdrop />

      <div className="relative mx-auto max-w-[1600px] px-4 pt-28 pb-24 sm:px-6 lg:pt-32">
        <Reveal>
          <span className="border-border/70 bg-card/70 inline-flex items-center gap-2.5 rounded-sm border py-1 pr-3 pl-1 text-xs">
            <span
              className="inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-[11px] font-semibold"
              style={{ backgroundColor: "rgba(239,68,68,0.12)", color: BRAND_RED }}
            >
              <IndianRupee className="h-3 w-3" />
              Pricing
            </span>
            <span className="text-muted-foreground">per employee, per month</span>
          </span>
        </Reveal>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start lg:gap-16 xl:gap-24">
          <Reveal>
            {/* Two explicit lines, not text-balance - the break is a design choice. */}
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

        <div className="mt-16 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {SHOWN.map((plan, i) => {
            const featured = plan.key === FEATURED
            const { amount, unit, taxed } = priceLabel(plan)
            return (
              <Reveal key={plan.key} delay={Math.min(i * 80, 240)}>
                <div
                  className={`flex h-full flex-col rounded-sm border p-6 ${
                    featured ? "bg-card/70" : "border-border/70 bg-card/40"
                  }`}
                  style={featured ? { borderColor: BRAND_RED } : undefined}
                >
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold">{plan.name}</h2>
                    {featured && (
                      <span
                        className="rounded-sm px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase"
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

        <Reveal delay={120}>
          <div className="border-border/70 bg-card/40 mt-16 rounded-sm border p-6 sm:p-8 lg:p-10">
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
                    className="inline-flex h-9 w-9 items-center justify-center rounded-sm"
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

        <Reveal delay={180}>
          <div
            className="relative mt-8 overflow-hidden rounded-sm border p-8 sm:p-10 lg:p-12"
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
                <Button asChild>
                  <Link href="/signup">
                    Start free
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline">
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
