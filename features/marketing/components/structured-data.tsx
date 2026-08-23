import { siteConfig } from "@/config/site"

/** JSON-LD for rich search results: the org + the product. Rendered once in the
 *  page head area. Kept data-only (no offers/pricing while pricing is hidden). */
export function StructuredData() {
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: siteConfig.company,
        url: siteConfig.url,
        description: siteConfig.description,
      },
      {
        "@type": "SoftwareApplication",
        name: siteConfig.fullName,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: siteConfig.url,
        description: siteConfig.description,
      },
    ],
  }
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  )
}
