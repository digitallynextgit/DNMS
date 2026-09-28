"use client"

import Link from "next/link"
import dynamic from "next/dynamic"
import { useSession } from "next-auth/react"
import { Fingerprint, Wallet, Sparkles, ArrowRight } from "lucide-react"

import { siteConfig } from "@/config/site"
import { Button } from "@/components/ui/button"
import { GridBackdrop } from "../fx"
import { BRAND_RED } from "@/features/marketing/marketing.constants"

// The mockup is a 400-line interactive component that pulls in motion/react.
// Code-split so the hero (and the headline's paint) never waits for it; its
// server HTML still renders, the interactivity hydrates when the chunk lands.
const HeroAppMockup = dynamic(() => import("../hero-app-mockup").then((m) => m.HeroAppMockup))

// Headline words as one flowing line so `text-balance` can split them into two
// even-width lines; "one platform" is the brand-red accent.
const WORDS: { text: string; red?: boolean }[] = [
  { text: "Run" },
  { text: "your" },
  { text: "entire" },
  { text: "company" },
  { text: "on" },
  { text: "one", red: true },
  { text: "platform", red: true },
]

const MODULES_LIST = [
  "HR",
  "Attendance",
  "Leave",
  "Payroll",
  "Projects",
  "Recruitment",
  "Portal",
  "SEO",
]

/**
 * Entrances are PURE CSS (animate-dnms-fade-up), not motion/react variants.
 * The old framer variants SSR'd the headline at opacity:0 + blur(8px), so the
 * page's LCP element could not paint until the whole client bundle hydrated -
 * on a slow connection the hero was a blank column. CSS animations start on
 * first paint with no JS, and prefers-reduced-motion turns them off in
 * globals.css.
 */
const enter = (delaySeconds: number): { className: string; style: React.CSSProperties } => ({
  className: "animate-dnms-fade-up",
  style: { animationDelay: `${delaySeconds}s` },
})

export function Hero() {
  const { data: session } = useSession()
  const authed = !!session?.user
  const appHref = session?.user?.kind === "client" ? "/portal" : "/dashboard"

  return (
    <section id="top" className="relative overflow-hidden">
      {/* Minimalist backdrop: faint grid. */}
      <GridBackdrop className="opacity-[0.5]" />

      <div className="relative mx-auto max-w-[1600px] px-4 pt-24 pb-16 sm:px-6 sm:pt-28">
        {/* ---- Top band: text left, panel right ---- */}
        <div className="grid items-start gap-12 lg:grid-cols-[1.65fr_1fr] lg:gap-16">
          {/* Left */}
          <div>
            <div {...enter(0)}>
              <a
                href="#modules"
                className="group border-border/70 bg-card/70 hover:bg-card inline-flex items-center gap-2.5 rounded-sm border py-1 pr-3 pl-1 text-xs backdrop-blur transition-colors"
              >
                <span
                  className="inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-[11px] font-semibold"
                  style={{ backgroundColor: "rgba(239,68,68,0.12)", color: BRAND_RED }}
                >
                  <Sparkles className="h-3 w-3" />
                  All-in-one
                </span>
                <span className="text-muted-foreground">10 modules, one login</span>
                <ArrowRight className="text-muted-foreground h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </a>
            </div>

            <h1 className="mt-6 text-4xl font-bold tracking-tight text-balance sm:text-6xl lg:text-7xl lg:leading-[1.03]">
              {WORDS.map((w, i) => (
                <span
                  key={w.text}
                  className="animate-dnms-fade-up mr-[0.22em] inline-block"
                  style={{
                    animationDelay: `${0.05 + i * 0.05}s`,
                    ...(w.red ? { color: BRAND_RED } : {}),
                  }}
                >
                  {w.text}
                </span>
              ))}
            </h1>

            <p
              {...enter(0.45)}
              className="animate-dnms-fade-up text-muted-foreground mt-6 max-w-3xl text-lg text-pretty sm:text-xl"
            >
              {siteConfig.description}
            </p>

            <div {...enter(0.55)} className="animate-dnms-fade-up mt-8 flex flex-wrap gap-3">
              {authed ? (
                <>
                  <Button asChild variant="outline">
                    <a href="#modules">Browse modules</a>
                  </Button>
                  <Button asChild>
                    <Link href={appHref}>
                      Go to dashboard
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                </>
              ) : (
                <>
                  <Button asChild>
                    <Link href="/signup">
                      Start free
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <a href="#modules">Browse modules</a>
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Right: clean panel (modules) - desktop only. Offset so its top
              lines up with the title, not the pill. The placeholder avatar/star
              "social proof" block that used to sit under the list was removed:
              fabricated trust signals on a public page are worse than none.
              Reinstate the section when there is REAL proof to show. */}
          <div {...enter(0.35)} className="animate-dnms-fade-up hidden lg:mt-14 lg:block">
            <div className="border-border bg-card/50 rounded-sm border p-6 sm:p-7">
              <div className="text-muted-foreground text-xs font-medium tracking-[0.16em] uppercase">
                Everything, in one login
              </div>
              <ul className="mt-5 grid grid-cols-2 gap-x-8 gap-y-3">
                {MODULES_LIST.map((m) => (
                  <li key={m} className="flex items-center gap-2.5 text-sm">
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: BRAND_RED }}
                    />
                    <span>{m}</span>
                  </li>
                ))}
              </ul>

              <div className="border-border/60 mt-6 border-t pt-5">
                <p className="text-muted-foreground text-sm">
                  One platform for the whole company - from attendance punches to client
                  deliverables.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ---- Interactive product mockup, centered below ---- */}
        <div {...enter(0.5)} className="animate-dnms-fade-up relative mx-auto mt-20 max-w-7xl">
          <HeroAppMockup />

          <div
            className="animate-dnms-float border-border bg-card absolute -top-6 -left-6 z-10 hidden items-center gap-2 rounded-sm border p-3 shadow-lg md:flex"
            style={{ animationDelay: "-3s" }}
          >
            <span
              className="flex h-8 w-8 items-center justify-center rounded-sm"
              style={{ backgroundColor: "rgba(239,68,68,0.12)", color: BRAND_RED }}
            >
              <Fingerprint className="h-4 w-4" />
            </span>
            <div className="text-left">
              <div className="text-xs font-semibold">Punch synced</div>
              <div className="text-muted-foreground text-[10px]">Present · 09:02</div>
            </div>
          </div>
          <div
            className="animate-dnms-float border-border bg-card absolute -right-6 bottom-8 z-10 hidden items-center gap-2 rounded-sm border p-3 shadow-lg md:flex"
            style={{ animationDelay: "-7s" }}
          >
            <span
              className="flex h-8 w-8 items-center justify-center rounded-sm"
              style={{ backgroundColor: "rgba(59,130,246,0.12)", color: "#3b82f6" }}
            >
              <Wallet className="h-4 w-4" />
            </span>
            <div className="text-left">
              <div className="text-xs font-semibold">Payroll approved</div>
              <div className="text-muted-foreground text-[10px]">142 payslips</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
