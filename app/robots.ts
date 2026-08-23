import type { MetadataRoute } from "next"
import { siteConfig } from "@/config/site"

// Only the public landing page should be crawled. The (dashboard) route group
// adds no URL segment, so the authed app lives at many top-level paths - list
// them explicitly. (The proxy already redirects crawlers off these to /login;
// this is the belt-and-braces signal.)
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/dashboard",
        "/employees",
        "/attendance",
        "/leave",
        "/wfh",
        "/payroll",
        "/performance",
        "/projects",
        "/recruitment",
        "/chat",
        "/gallery",
        "/documents",
        "/docs",
        "/holidays",
        "/holiday-calendar",
        "/announcements",
        "/notifications",
        "/profile",
        "/referrals",
        "/resignations",
        "/admin",
        "/analytics",
        "/portal",
        "/login",
        "/client-login",
        "/forgot-password",
      ],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  }
}
