import Link from "next/link"
import { Mail, MapPin, MessageSquare, Clock, Phone, LifeBuoy, ShieldCheck } from "lucide-react"

import { siteConfig } from "@/config/site"
import { BRAND_RED } from "@/features/marketing/marketing.constants"
import { GridBackdrop, Reveal } from "../fx"
import { ContactForm } from "../contact-form"

const { emails, legal, contact } = siteConfig

/** Direct routes, for people who would rather not use a form. */
const CHANNELS = [
  {
    icon: Mail,
    title: "Sales & demos",
    detail: emails.sales,
    href: `mailto:${emails.sales}`,
    note: "New workspaces, pricing, rollout questions.",
  },
  {
    icon: LifeBuoy,
    title: "Support",
    detail: emails.support,
    href: `mailto:${emails.support}`,
    note: "Something broken or behaving oddly.",
  },
  {
    icon: ShieldCheck,
    title: "Privacy & data",
    detail: emails.privacy,
    href: `mailto:${emails.privacy}`,
    note: "Access, correction and deletion requests.",
  },
]

/** Contact page body: form on the left, direct channels on the right. */
export function ContactContent() {
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
              <MessageSquare className="h-3 w-3" />
              Contact
            </span>
            <span className="text-muted-foreground">we read everything</span>
          </span>
        </Reveal>

        {/* Title left, standfirst right, both STARTING on the same line - the
            same header treatment as About and Pricing.

            The heading is NOT split onto two lines here. On those pages the red
            phrase is two or three words and earns its own line; "solve." is one
            short word, and giving it a line of its own leaves an orphan rather
            than a second line. It fits comfortably on one at this size. */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)] lg:items-start lg:gap-12 xl:gap-16">
          <Reveal delay={60}>
            <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
              Tell us what you&rsquo;re trying to <span style={{ color: BRAND_RED }}>solve.</span>
            </h1>
          </Reveal>

          <Reveal delay={120}>
            <p className="text-muted-foreground text-lg text-pretty">
              Whether you want a walkthrough, have a question about how something works, or need to
              reach us about your data, this reaches a person.
            </p>
          </Reveal>
        </div>

        {/* ── Form + channels ────────────────────────────────────────────── */}
        <div className="mt-14 grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-16 xl:gap-24">
          <Reveal>
            <div className="border-border/70 bg-card/50 rounded-sm border p-6 sm:p-8">
              <h2 className="text-lg font-semibold">Send us a message</h2>
              <p className="text-muted-foreground mt-1.5 text-sm">
                Most messages get a reply within one business day.
              </p>
              <ContactForm className="mt-6" />
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div className="space-y-8">
              <div>
                <h2 className="text-foreground text-xs font-semibold tracking-wide uppercase">
                  Straight to the right inbox
                </h2>
                <ul className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                  {CHANNELS.map(({ icon: Icon, title, detail, href, note }) => (
                    <li key={title}>
                      <a
                        href={href}
                        className="border-border/70 bg-card/50 hover:border-border block rounded-sm border p-4 transition-colors"
                      >
                        <span className="flex items-center gap-2.5">
                          <Icon className="h-4 w-4 shrink-0" style={{ color: BRAND_RED }} />
                          <span className="text-sm font-semibold">{title}</span>
                        </span>
                        <span className="text-foreground mt-2 block text-sm break-all">
                          {detail}
                        </span>
                        <span className="text-muted-foreground mt-1 block text-xs">{note}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="border-border/60 border-t pt-6">
                <h2 className="text-foreground text-xs font-semibold tracking-wide uppercase">
                  Where we are
                </h2>
                <ul className="mt-4 space-y-3 text-sm">
                  <li className="flex gap-3">
                    <MapPin
                      className="mt-0.5 h-4 w-4 shrink-0"
                      style={{ color: BRAND_RED }}
                      aria-hidden
                    />
                    <span>
                      <span className="font-medium">{legal.entity}</span>
                      <br />
                      <span className="text-muted-foreground">{legal.address}</span>
                    </span>
                  </li>
                  {contact.hours && (
                    <li className="flex gap-3">
                      <Clock
                        className="mt-0.5 h-4 w-4 shrink-0"
                        style={{ color: BRAND_RED }}
                        aria-hidden
                      />
                      <span className="text-muted-foreground">{contact.hours}</span>
                    </li>
                  )}
                  {contact.phone && (
                    <li className="flex gap-3">
                      <Phone
                        className="mt-0.5 h-4 w-4 shrink-0"
                        style={{ color: BRAND_RED }}
                        aria-hidden
                      />
                      <a
                        href={`tel:${contact.phone.replace(/\s+/g, "")}`}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {contact.phone}
                      </a>
                    </li>
                  )}
                </ul>
              </div>

              <div className="border-border/60 border-t pt-6">
                <h2 className="text-foreground text-xs font-semibold tracking-wide uppercase">
                  Already a customer?
                </h2>
                <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                  Sign in and use the help section inside your workspace, and we will already know
                  which company you are writing about.
                </p>
                <Link
                  href="/login"
                  className="text-foreground mt-3 inline-block text-sm underline underline-offset-4"
                >
                  Log in
                </Link>
              </div>

              <div className="border-border/60 border-t pt-6">
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Formal complaints about personal data can be addressed to our Grievance Officer at{" "}
                  <a
                    href={`mailto:${emails.grievance}`}
                    className="text-foreground underline underline-offset-4"
                  >
                    {emails.grievance}
                  </a>
                  . See the{" "}
                  <Link
                    href="/legal/privacy"
                    className="text-foreground underline underline-offset-4"
                  >
                    Privacy Policy
                  </Link>{" "}
                  for how we handle requests.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  )
}
