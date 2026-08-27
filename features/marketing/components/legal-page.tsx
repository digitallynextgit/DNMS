import Link from "next/link"
import { FileText } from "lucide-react"

import { siteConfig } from "@/config/site"
import { BRAND_RED } from "@/features/marketing/marketing.constants"
import { LEGAL_INDEX, type LegalDoc } from "@/features/marketing/legal.content"
import { GridBackdrop, Reveal } from "./fx"
import { SectionNav } from "./section-nav"

/**
 * Heading -> URL fragment. Deterministic, so a link someone shares today still
 * lands on the same section after the copy around it is edited.
 */
function anchorFor(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/**
 * Split a title so its tail can carry the brand accent, matching the hero and
 * the About and Contact headings.
 *
 * Presentational only: `doc.title` stays a plain string everywhere it has to be
 * one - the contents rail, the footer, the sitemap and the <title> tag - so the
 * accent never leaks into a place that cannot render markup.
 *
 * The last word is the default and reads well for most titles: "Privacy
 * POLICY", "Terms & CONDITIONS", "Cookie POLICY". A document can override it
 * with `titleAccent` where that splits a phrase that belongs together - the
 * refund policy accents "Cancellation Policy" rather than stranding "Policy".
 *
 * An override that is not actually a suffix of the title is ignored rather than
 * trusted: rendering `lead` and `accent` from mismatched strings would drop or
 * duplicate characters in the heading, which is worse than the wrong word being
 * red.
 */
function splitTitle(title: string, override?: string): { lead: string; accent: string } {
  if (override && override !== title && title.endsWith(override)) {
    return { lead: title.slice(0, title.length - override.length), accent: override }
  }
  const cut = title.lastIndexOf(" ")
  if (cut === -1) return { lead: "", accent: title }
  return { lead: title.slice(0, cut + 1), accent: title.slice(cut + 1) }
}

/**
 * Renderer for every legal document. The documents themselves are data in
 * legal.content.ts, so all four pages stay typographically identical and a new
 * one is a content edit rather than a new component.
 *
 * ── WHY THREE COLUMNS ──────────────────────────────────────────────────────
 *
 * This page uses the full 1600px marketing container, but a document cannot
 * simply be stretched into it: prose stops being readable somewhere around 80
 * characters, and a 900px line is exhausting. The first attempt put a 68ch
 * article in a two-column 1600px grid, which left a ~600px dead strip and made
 * the text look abandoned in the corner.
 *
 * So the width is filled with content rather than with the article: navigation
 * on the left, the document in the middle, related documents on the right. Both
 * rails are sticky and useful, the measure stays readable, and there is content
 * at both edges of the screen.
 *
 * Prose is capped at 76ch. The definition lists are NOT - a term/detail pair
 * reads perfectly well wide, and letting them fill the column gives the page
 * some rhythm instead of one uniform ribbon of text.
 */
export function LegalPage({ doc }: { doc: LegalDoc }) {
  const { lead, accent } = splitTitle(doc.title, doc.titleAccent)

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
              <FileText className="h-3 w-3" />
              Legal
            </span>
            <span className="text-muted-foreground">last updated {doc.updated}</span>
          </span>
        </Reveal>

        <Reveal delay={60}>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            {lead}
            <span style={{ color: BRAND_RED }}>{accent}</span>
          </h1>
          <p className="text-muted-foreground mt-4 max-w-3xl text-lg text-pretty">{doc.summary}</p>
        </Reveal>

        {/* Three columns from lg. Below that everything stacks, with the
            contents list first - on a phone it is the fastest way into a long
            document rather than something to scroll past. */}
        <div className="mt-14 grid gap-12 lg:grid-cols-[200px_minmax(0,1fr)_240px] lg:gap-8 xl:grid-cols-[230px_minmax(0,1fr)_290px] xl:gap-14">
          {/* ── Left rail: contents ──────────────────────────────────────── */}
          <SectionNav
            heading="On this page"
            accent={BRAND_RED}
            items={doc.sections.map((s) => ({
              anchor: anchorFor(s.heading),
              label: s.heading,
            }))}
          />

          {/* ── Document ─────────────────────────────────────────────────── */}
          <article className="min-w-0">
            {doc.sections.map((section, i) => (
              <Reveal key={section.heading} delay={Math.min(i * 40, 240)}>
                {/* scroll-mt clears the sticky header when arriving by anchor -
                    without it the heading lands underneath the nav bar. */}
                <section
                  id={anchorFor(section.heading)}
                  className="border-border/60 scroll-mt-28 border-t py-8 first:border-t-0 first:pt-0"
                >
                  <h2 className="text-xl font-semibold tracking-tight">{section.heading}</h2>

                  {section.body?.map((p) => (
                    <p
                      key={p.slice(0, 40)}
                      className="text-muted-foreground mt-4 max-w-[76ch] leading-relaxed"
                    >
                      {p}
                    </p>
                  ))}

                  {section.bullets && (
                    <ul className="mt-4 max-w-[76ch] space-y-2.5">
                      {section.bullets.map((b) => (
                        <li key={b.slice(0, 40)} className="flex gap-3">
                          <span
                            aria-hidden
                            className="mt-[0.6em] h-1 w-1 shrink-0 rounded-full"
                            style={{ backgroundColor: BRAND_RED }}
                          />
                          <span className="text-muted-foreground leading-relaxed">{b}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Deliberately uncapped: a term beside its detail reads fine
                      at full column width, and these carry the densest content
                      on the page - the sub-processor and data-category tables. */}
                  {section.rows && (
                    <dl className="border-border/60 mt-5 divide-y rounded-[6px] border">
                      {section.rows.map((row) => (
                        <div key={row.term} className="p-4 sm:flex sm:gap-8">
                          <dt className="text-foreground shrink-0 text-sm font-semibold sm:w-56">
                            {row.term}
                          </dt>
                          <dd className="text-muted-foreground mt-1.5 text-sm leading-relaxed sm:mt-0">
                            {row.detail}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </section>
              </Reveal>
            ))}
          </article>

          {/* ── Right rail: sibling documents ────────────────────────────── */}
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <h2 className="text-foreground text-xs font-semibold tracking-wide uppercase">
              Other documents
            </h2>
            <ul className="mt-4 space-y-1">
              {LEGAL_INDEX.map((item) => {
                const current = item.slug === doc.slug
                return (
                  <li key={item.slug}>
                    <Link
                      href={`/legal/${item.slug}`}
                      aria-current={current ? "page" : undefined}
                      className={
                        current
                          ? "bg-card/70 border-border/70 block rounded-[6px] border px-3 py-2.5"
                          : "hover:bg-card/50 block rounded-[6px] border border-transparent px-3 py-2.5 transition-colors"
                      }
                    >
                      <span
                        className="block text-sm font-medium"
                        style={current ? { color: BRAND_RED } : undefined}
                      >
                        {item.title}
                      </span>
                      <span className="text-muted-foreground mt-0.5 block text-xs">
                        {item.blurb}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>

            <div className="border-border/60 mt-8 border-t pt-6">
              <p className="text-muted-foreground text-xs leading-relaxed">
                Questions about this document? Write to{" "}
                <a
                  href={`mailto:${siteConfig.emails.privacy}`}
                  className="text-foreground underline underline-offset-4"
                >
                  {siteConfig.emails.privacy}
                </a>
                .
              </p>
            </div>

            <div className="border-border/60 mt-6 border-t pt-6">
              <p className="text-muted-foreground text-xs leading-relaxed">
                {siteConfig.legal.entity}
                <br />
                {siteConfig.legal.address}
              </p>
              <Link
                href="/contact"
                className="text-foreground mt-3 inline-block text-xs underline underline-offset-4"
              >
                Contact us
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
