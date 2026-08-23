import type { MetadataRoute } from "next"
import { siteConfig } from "@/config/site"

// Only the public marketing page is indexable; every other route is a gated app
// screen. Add public pages here (e.g. a future /careers) as they ship.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteConfig.url,
      changeFrequency: "monthly",
      priority: 1,
    },
  ]
}
