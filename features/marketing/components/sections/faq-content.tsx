import Link from "next/link"
import { ArrowRight, HelpCircle } from "lucide-react"

import { siteConfig } from "@/config/site"
import { Button } from "@/components/ui/button"
import { BRAND_RED, demoHref } from "@/features/marketing/marketing.constants"
import { FAQ_CATEGORIES, ALL_FAQS } from "@/features/marketing/faq.content"
import { GridBackdrop, Reveal } from "../fx"
import { SectionNav } from "../section-nav"

/**
 * The /faq page.
 *
 * Deliberately NOT an accordion, unlike the homepage section. That one is a
 * teaser inside a long scroll, where collapsing keeps the page moving. This page
 * is where somebody arrives with a question, so every answer is open and on the
 * page: findable with the browser's own search, linkable, and readable without
 * clicking anything.
 */
export function FaqContent() {
  return (
    <div className="relative">
      <GridBackdrop />

      <div className="relative mx-auto max-w-[1600px] px-4 pt-28 pb-24 sm:px-6 lg:pt-32">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <Reveal>
          <span className="border-border/70 bg-card/70 inline-flex items-center gap-2.5 rounded-sm border py-1 pr-3 pl-1 text-xs">
            <span
              className="inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-[11px] font-semibold"
              style={{ backgroundColor: "rgba(239,68,68,0.12)", color: BRAND_RED }}
            >
              <HelpCircle className="h-3 w-3" />
              FAQ
            </span>
            <span className="text-muted-foreground">{ALL_FAQS.length} questions answered</span>
          </span>
        </Reveal>

        {/* Title left, standfirst right, both starting on the same line - the
            same header treatment as About, Contact and Pricing. */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)] lg:items-start lg:gap-12 xl:gap-16">
          <Reveal delay={60}>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl xl:text-[3.25rem]">
              <span className="block">Everything people ask</span>
              <span className="block" style={{ color: BRAND_RED }}>
                before they sign up.
              </span>
            </h1>
          </Reveal>
          <Reveal delay={120}>
            <p className="text-muted-foreground text-lg text-pretty">
              How DNMS fits your company: what it covers, how it connects the devices and data you
              already have, how access and security work, and what it costs as your team grows.
            </p>
          </Reveal>
        </div>

        {/* ── Categories + answers ───────────────────────────────────────── */}
        <div className="mt-16 grid gap-12 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-12 xl:grid-cols-[250px_minmax(0,1fr)] xl:gap-20">
          {/* The same scroll-spy rail the legal documents use, so the topic you
              are reading is marked rather than left for you to work out. */}
          <SectionNav
            heading="Topics"
            accent={BRAND_RED}
            items={FAQ_CATEGORIES.map((cat) => ({
              anchor: cat.id,
              label: cat.title,
              meta: `${cat.items.length} question${cat.items.length === 1 ? "" : "s"}`,
            }))}
          >
            <div className="border-border/60 mt-8 border-t pt-6">
              <p className="text-muted-foreground text-xs leading-relaxed">
                Not answered here?{" "}
                <Link href="/contact" className="text-foreground underline underline-offset-4">
                  Ask us directly
                </Link>
                .
              </p>
            </div>
          </SectionNav>

          <div className="min-w-0 space-y-14">
            {FAQ_CATEGORIES.map((cat, ci) => (
              <section key={cat.id} id={cat.id} className="scroll-mt-28">
                <Reveal>
                  <div className="border-border/60 border-b pb-4">
                    <h2 className="text-xl font-semibold tracking-tight">{cat.title}</h2>
                    <p className="text-muted-foreground mt-1 text-sm">{cat.blurb}</p>
                  </div>
                </Reveal>

                <dl className="mt-6 space-y-6">
                  {cat.items.map((item, i) => (
                    <Reveal key={item.q} delay={Math.min(ci * 40 + i * 40, 240)}>
                      <div className="border-border/70 bg-card/40 rounded-sm border p-5 sm:p-6">
                        <dt className="text-base font-semibold">{item.q}</dt>
                        <dd className="text-muted-foreground mt-2 max-w-[76ch] leading-relaxed">
                          {item.a}
                        </dd>
                      </div>
                    </Reveal>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        </div>

        {/* ── CTA ────────────────────────────────────────────────────────── */}
        <Reveal delay={120}>
          <div
            className="relative mt-16 overflow-hidden rounded-sm border p-8 sm:p-10 lg:p-12"
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
                  Still have a question?
                </h2>
                <p className="text-muted-foreground mt-3 max-w-2xl text-pretty">
                  The trial answers most of them faster than we can: 21 days, every module, your own
                  data. If you would rather ask a person first, that works too.
                </p>
                <p className="text-muted-foreground mt-5 text-sm">
                  Or email us at{" "}
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
