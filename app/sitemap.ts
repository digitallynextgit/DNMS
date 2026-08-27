import type { MetadataRoute } from "next"
import { siteConfig } from "@/config/site"
import { LEGAL_INDEX } from "@/features/marketing/legal.content"

// Only PUBLIC pages belong here; every other route is a gated app screen.
// The legal documents are generated from LEGAL_INDEX so a new one is indexed
// the moment it exists, rather than being added here and forgotten.
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
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ]
}
