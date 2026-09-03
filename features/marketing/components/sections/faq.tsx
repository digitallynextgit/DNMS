"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRight, ChevronDown, Sparkles } from "lucide-react"

import { cn } from "@/lib/utils"
import { FEATURED_FAQS, ALL_FAQS } from "../../faq.content"
import { Reveal } from "../fx"
import { BRAND_RED } from "@/features/marketing/marketing.constants"

/** Accordion of frequently-asked questions. One item open at a time. */
export function Faq() {
  const [open, setOpen] = React.useState<number | null>(0)

  return (
    <section id="faq" className="relative scroll-mt-20 py-20 sm:py-24">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6">
        {/* Hero-style pill */}
        <Reveal>
          <span className="border-border/70 bg-card/70 inline-flex items-center gap-2.5 rounded-sm border py-1 pr-3 pl-1 text-xs">
            <span
              className="inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-[11px] font-semibold"
              style={{ backgroundColor: "rgba(239,68,68,0.12)", color: BRAND_RED }}
            >
              <Sparkles className="h-3 w-3" />
              FAQ
            </span>
            <span className="text-muted-foreground">answered</span>
          </span>
        </Reveal>

        {/* Two columns: title (left) + supporting copy (right) */}
        <div className="mt-6 grid items-start gap-8 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <h2 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
              Frequently asked <span style={{ color: BRAND_RED }}>questions</span>
            </h2>
          </Reveal>
          <Reveal delay={120}>
            <p className="text-muted-foreground text-lg text-pretty lg:text-xl">
              Everything you need to know about how DNMS fits your company: what it covers, how it
              connects your existing devices and data, how access and security work, and how it
              scales as your team grows.
            </p>
          </Reveal>
        </div>

        <div className="mt-12 space-y-3">
          {FEATURED_FAQS.map((item, i) => {
            const isOpen = open === i
            const panelId = `faq-panel-${i}`
            const btnId = `faq-btn-${i}`
            return (
              <Reveal key={item.q} delay={i * 80}>
                <div className="border-border bg-card rounded-sm border">
                  <button
                    id={btnId}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  >
                    <span className="text-sm font-semibold sm:text-base">{item.q}</span>
                    <ChevronDown
                      className={cn(
                        "text-muted-foreground h-4 w-4 shrink-0 transition-transform duration-300",
                        isOpen && "rotate-180",
                      )}
                    />
                  </button>
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={btnId}
                    className={cn(
                      "grid transition-all duration-300 ease-out",
                      isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                    )}
                  >
                    <div className="overflow-hidden">
                      <p className="text-muted-foreground px-5 pb-5 text-sm text-pretty">
                        {item.a}
                      </p>
                    </div>
                  </div>
                </div>
              </Reveal>
            )
          })}
        </div>

        {/* The homepage carries a selection, not the whole set. Saying how many
            are left is what makes this a route rather than a dead end. */}
        <Reveal delay={FEATURED_FAQS.length * 80}>
          <div className="mt-10 flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link
              href="/faq"
              className="text-foreground inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-4"
            >
              See all {ALL_FAQS.length} questions
              <ArrowRight className="h-4 w-4" />
            </Link>
            <span className="text-muted-foreground text-sm">
              or{" "}
              <Link href="/contact" className="text-foreground underline underline-offset-4">
                ask us yours
              </Link>
            </span>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
