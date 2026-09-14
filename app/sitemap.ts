import type { MetadataRoute } from "next"
import { siteConfig } from "@/config/site"
import { LEGAL_DOCS, LEGAL_INDEX } from "@/features/marketing/legal.content"

// Only PUBLIC pages belong here; every other route is a gated app screen.
// The legal documents are generated from LEGAL_INDEX so a new one is indexed
// the moment it exists, rather than being added here and forgotten.
//
// Keep this list and the allow-list in app/robots.ts in step: a URL submitted
// here and denied there is a contradiction that Search Console reports as an
// error.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteConfig.url.replace(/\/$/, "")

  return [
    { url: base, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/about`, changeFrequency: "yearly", priority: 0.7 },
    { url: `${base}/contact`, changeFrequency: "yearly", priority: 0.7 },
    { url: `${base}/pricing`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/faq`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/signup`, changeFrequency: "monthly", priority: 0.9 },
    ...LEGAL_INDEX.map((d) => ({
      url: `${base}/legal/${d.slug}`,
      // The revision date the document itself prints, so the sitemap cannot
      // claim a freshness the page contradicts. Only the legal pages carry a
      // real date - the others are deliberately left without one rather than
      // stamped with a build time, which would tell crawlers the whole site
      // changed on every deploy.
      lastModified: legalDate(d.slug),
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ]
}

/**
 * "26 August 2026" -> Date, or undefined if the string is ever edited into
 * something unparseable.
 *
 * Parsed as UTC, not local time. Without the suffix the date is read as local
 * midnight, which on any timezone east of Greenwich lands the previous day in
 * the emitted `<lastmod>` - IST turned "26 August" into 2026-08-25T18:30Z, a
 * sitemap contradicting the revision date printed on the page it points at.
 */
function legalDate(slug: keyof typeof LEGAL_DOCS): Date | undefined {
  const parsed = Date.parse(`${LEGAL_DOCS[slug].updated} UTC`)
  return Number.isNaN(parsed) ? undefined : new Date(parsed)
}
