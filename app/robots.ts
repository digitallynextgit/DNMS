import type { MetadataRoute } from "next"
import { siteConfig } from "@/lib/site"

// An allow-list: deny everything and name the few public pages, so new tenants and gated
// sections are private by default. "/$" allows only the homepage. Keep in step with app/sitemap.ts.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/$", "/about", "/contact", "/pricing", "/faq", "/legal/", "/signup"],
        disallow: "/",
      },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  }
}
