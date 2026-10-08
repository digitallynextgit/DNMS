"use client"

import Link from "next/link"
import { ArrowRight, CreditCard, Clock, ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { BRAND_RED, demoHref } from "@/features/marketing/marketing.constants"
import { useMarketingSession } from "../../hooks/use-marketing-session"
import { GridBackdrop, Reveal } from "../fx"

const REASSURANCES = [
  { icon: Clock, label: "21-day trial" },
  { icon: CreditCard, label: "No card required" },
  { icon: ShieldCheck, label: "Cancel anytime" },
]

/** The signup band. Client-side session (useMarketingSession), so the homepage stays static. */
export function SignupCta() {
  const { appHref } = useMarketingSession()

  return (
    <section id="get-started" className="relative overflow-hidden py-24">
      <GridBackdrop />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          background: `radial-gradient(60% 50% at 50% 45%, ${BRAND_RED} 0%, transparent 70%)`,
        }}
      />

      <div className="relative mx-auto max-w-[1600px] px-4 text-center sm:px-6">
        <Reveal>
          <h2 className="mx-auto max-w-4xl text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            <span className="auth-member">
              Your workspace is <span style={{ color: BRAND_RED }}>ready.</span>
            </span>
            <span className="auth-guest">
              Set your company up in <span style={{ color: BRAND_RED }}>a few minutes.</span>
            </span>
          </h2>
        </Reveal>

        <Reveal delay={100}>
          <p className="text-muted-foreground mx-auto mt-5 max-w-2xl text-lg text-pretty">
            <span className="auth-member">
              Pick up where you left off, or talk to us about rolling DNMS out to another team.
            </span>
            <span className="auth-guest">
              Create a workspace, invite your team, and start running attendance, leave, payroll and
              projects on one system of record. Nothing to install.
            </span>
          </p>
        </Reveal>

        <Reveal delay={180}>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Button asChild className="auth-member">
              <Link href={appHref}>
                Go to dashboard
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="auth-member">
              <Link href="/contact">Talk to us</Link>
            </Button>
            <Button asChild className="auth-guest">
              <Link href="/signup">
                Start free
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="auth-guest">
              <a href={demoHref}>Book a demo</a>
            </Button>
          </div>
        </Reveal>

        <div className="auth-guest">
          <Reveal delay={240}>
            <ul className="text-muted-foreground mt-8 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-sm">
              {REASSURANCES.map(({ icon: Icon, label }) => (
                <li key={label} className="inline-flex items-center gap-2">
                  <Icon className="h-4 w-4" style={{ color: BRAND_RED }} />
                  {label}
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground mt-6 text-sm">
              Already have an account?{" "}
              <Link href="/login" className="text-foreground underline underline-offset-4">
                Log in
              </Link>
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
