import type { MetadataRoute } from "next"
import { siteConfig } from "@/config/site"

// ─── WHY THIS IS AN ALLOW-LIST ───────────────────────────────────────────────
// This file used to disallow the app's INTERNAL paths - /dashboard, /employees,
// /projects and so on. Those are not addresses a crawler can reach. Signed-in
// pages live at /{tenantSlug}/... (proxy.ts rewrites the prefixed URL onto the
// internal route), so every rule in that list matched a URL that is never linked
// and never served, while the real URL space - one path segment per customer,
// unknowable ahead of time - was not covered by anything.
//
// Inverting it fixes that permanently: deny everything, then name the handful of
// pages that ARE public. A new tenant, or a new gated section, is then private by
// default rather than private only if somebody remembers to add a line here.
//
// "/$" is the end-of-URL anchor: it allows exactly the homepage, not the whole
// site. Sitemap-listed pages and this list must agree - see app/sitemap.ts.
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
