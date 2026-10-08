import type { MetadataRoute } from "next"
import { siteConfig } from "@/lib/site"

/**
 * start_url is the internal path: this file is static, and proxy.ts redirects /dashboard to the
 * tenant (or /login). Icons aren't maskable - they fill the square, so a maskable crop would cut the mark.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.fullName,
    short_name: siteConfig.name,
    description: siteConfig.description,
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  }
}
