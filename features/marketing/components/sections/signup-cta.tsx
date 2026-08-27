import Link from "next/link"
import { ArrowRight, CreditCard, Clock, ShieldCheck } from "lucide-react"

import { auth } from "@/server/auth"
import { Button } from "@/components/ui/button"
import { BRAND_RED, demoHref } from "@/features/marketing/marketing.constants"
import { GridBackdrop, Reveal } from "../fx"

const REASSURANCES = [
  { icon: Clock, label: "21-day trial" },
  { icon: CreditCard, label: "No card required" },
  { icon: ShieldCheck, label: "Cancel anytime" },
]

/**
 * The conversion band: the one place on the page that asks for a signup.
 *
 * Server component so it can read the session - showing "Start free" to someone
 * already signed in is the kind of small wrongness that makes a site feel
 * untended, and they get a route back into their workspace instead.
 */
export async function SignupCta() {
  const session = await auth()
  const authed = Boolean(session)
  const appHref = session?.user.kind === "client" ? "/portal" : "/dashboard"

  return (
    <section id="get-started" className="relative overflow-hidden py-24">
      <GridBackdrop />

      {/* Warm wash behind the band so it reads as the page's destination. */}
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
            {authed ? (
              <>
                Your workspace is <span style={{ color: BRAND_RED }}>ready.</span>
              </>
            ) : (
              <>
                Set your company up in <span style={{ color: BRAND_RED }}>a few minutes.</span>
              </>
            )}
          </h2>
        </Reveal>

        <Reveal delay={100}>
          <p className="text-muted-foreground mx-auto mt-5 max-w-2xl text-lg text-pretty">
            {authed
              ? "Pick up where you left off, or talk to us about rolling DNMS out to another team."
              : "Create a workspace, invite your team, and start running attendance, leave, payroll and projects on one system of record. Nothing to install."}
          </p>
        </Reveal>

        <Reveal delay={180}>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            {authed ? (
              <>
                <Button asChild size="lg">
                  <Link href={appHref}>
                    Go to dashboard
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/contact">Talk to us</Link>
                </Button>
              </>
            ) : (
              <>
                <Button asChild size="lg">
                  <Link href="/signup">
                    Start free
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <a href={demoHref}>Book a demo</a>
                </Button>
              </>
            )}
          </div>
        </Reveal>

        {!authed && (
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
        )}
      </div>
    </section>
  )
}
