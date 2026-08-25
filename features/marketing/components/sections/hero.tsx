"use client"

import Link from "next/link"
import { useSession } from "next-auth/react"
import { motion, type Variants } from "motion/react"
import { Fingerprint, Wallet, Star, Sparkles, ArrowRight } from "lucide-react"

import { siteConfig } from "@/config/site"
import { Button } from "@/components/ui/button"
import { GridBackdrop } from "../fx"
import { HeroAppMockup } from "../hero-app-mockup"
import { BRAND_RED } from "@/features/marketing/marketing.constants"

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
// Generic placeholder avatars (initials, not real people) - swap for real proof.
const AVATARS = ["A", "R", "M", "K", "S"]

const word: Variants = {
  hidden: { opacity: 0, y: 16, filter: "blur(8px)" },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { delay: 0.08 + i * 0.06, duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  }),
}

const fade: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: (d: number) => ({ opacity: 1, y: 0, transition: { delay: d, duration: 0.6 } }),
}

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
            <motion.div variants={fade} custom={0} initial="hidden" animate="show">
              <a
                href="#modules"
                className="group border-border/70 bg-card/70 hover:bg-card inline-flex items-center gap-2.5 rounded-[6px] border py-1 pr-3 pl-1 text-xs backdrop-blur transition-colors"
              >
                <span
                  className="inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-1 text-[11px] font-semibold"
                  style={{ backgroundColor: "rgba(239,68,68,0.12)", color: BRAND_RED }}
                >
                  <Sparkles className="h-3 w-3" />
                  All-in-one
                </span>
                <span className="text-muted-foreground">10 modules, one login</span>
                <ArrowRight className="text-muted-foreground h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </a>
            </motion.div>

            <h1 className="mt-6 text-4xl font-bold tracking-tight text-balance sm:text-6xl lg:text-7xl lg:leading-[1.03]">
              {WORDS.map((w, i) => (
                <motion.span
                  key={w.text}
                  custom={i}
                  variants={word}
                  initial="hidden"
                  animate="show"
                  className="mr-[0.22em] inline-block"
                  style={w.red ? { color: BRAND_RED } : undefined}
                >
                  {w.text}
                </motion.span>
              ))}
            </h1>

            <motion.p
              variants={fade}
              custom={0.7}
              initial="hidden"
              animate="show"
              className="text-muted-foreground mt-6 max-w-3xl text-lg text-pretty sm:text-xl"
            >
              {siteConfig.description}
            </motion.p>

            <motion.div
              variants={fade}
              custom={0.85}
              initial="hidden"
              animate="show"
              className="mt-8 flex flex-wrap gap-3"
            >
              <Button asChild size="lg" variant="outline">
                <a href="#modules">Browse modules</a>
              </Button>
              <Button asChild size="lg">
                <Link href={authed ? appHref : "/login"}>
                  {authed ? "Go to dashboard" : "Log in"}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </motion.div>
          </div>

          {/* Right: clean panel (modules + trust) - desktop only. Offset so its
              top lines up with the title, not the pill. */}
          <motion.div
            variants={fade}
            custom={0.55}
            initial="hidden"
            animate="show"
            className="hidden lg:mt-14 lg:block"
          >
            <div className="border-border bg-card/50 rounded-[6px] border p-6 sm:p-7">
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
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {AVATARS.map((c, i) => (
                      <span
                        key={i}
                        className="border-card flex h-8 w-8 items-center justify-center rounded-full border-2 bg-gradient-to-br from-neutral-500 to-neutral-800 text-[10px] font-medium text-white"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-0.5 text-amber-400">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-current" />
                    ))}
                  </div>
                </div>
                <p className="text-muted-foreground mt-3 text-sm">
                  Trusted by teams running their whole company on one platform.
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* ---- Interactive product mockup, centered below ---- */}
        <motion.div
          variants={fade}
          custom={0.65}
          initial="hidden"
          animate="show"
          className="relative mx-auto mt-20 max-w-7xl"
        >
          <HeroAppMockup />

          <motion.div
            variants={fade}
            custom={1.1}
            initial="hidden"
            animate="show"
            className="animate-dnms-float border-border bg-card absolute -top-6 -left-6 z-10 hidden items-center gap-2 rounded-[6px] border p-3 shadow-lg md:flex"
            style={{ animationDelay: "-3s" }}
          >
            <span
              className="flex h-8 w-8 items-center justify-center rounded-[6px]"
              style={{ backgroundColor: "rgba(239,68,68,0.12)", color: BRAND_RED }}
            >
              <Fingerprint className="h-4 w-4" />
            </span>
            <div className="text-left">
              <div className="text-xs font-semibold">Punch synced</div>
              <div className="text-muted-foreground text-[10px]">Present · 09:02</div>
            </div>
          </motion.div>
          <motion.div
            variants={fade}
            custom={1.25}
            initial="hidden"
            animate="show"
            className="animate-dnms-float border-border bg-card absolute -right-6 bottom-8 z-10 hidden items-center gap-2 rounded-[6px] border p-3 shadow-lg md:flex"
            style={{ animationDelay: "-7s" }}
          >
            <span
              className="flex h-8 w-8 items-center justify-center rounded-[6px]"
              style={{ backgroundColor: "rgba(59,130,246,0.12)", color: "#3b82f6" }}
            >
              <Wallet className="h-4 w-4" />
            </span>
            <div className="text-left">
              <div className="text-xs font-semibold">Payroll approved</div>
              <div className="text-muted-foreground text-[10px]">142 payslips</div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
