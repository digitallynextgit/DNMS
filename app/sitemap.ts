import type { MetadataRoute } from "next"
import { siteConfig } from "@/lib/site"
import { LEGAL_DOCS, LEGAL_INDEX } from "@/features/marketing/legal.content"

// Public pages only. Keep in step with the allow-list in app/robots.ts - Search Console flags
// a URL submitted here but denied there.
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
      // The date the document prints. Other pages get none - a build time would claim the whole site
      // changed on every deploy.
      lastModified: legalDate(d.slug),
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ]
}

/** Parsed as UTC: as local midnight, IST would emit the previous day in <lastmod>. */
function legalDate(slug: keyof typeof LEGAL_DOCS): Date | undefined {
  const parsed = Date.parse(`${LEGAL_DOCS[slug].updated} UTC`)
  return Number.isNaN(parsed) ? undefined : new Date(parsed)
}
