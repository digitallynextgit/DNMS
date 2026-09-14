import type { MetadataRoute } from "next"
import { siteConfig } from "@/config/site"

/**
 * Web app manifest, served at /manifest.webmanifest.
 *
 * The pieces of an installable app were already here - a service worker
 * (public/sw.js, which backs Web Push), an apple-touch-icon and a favicon - but
 * without this file none of it could be installed: a manifest with a name, a
 * start URL and a 192px + 512px icon is what makes the browser offer "Install".
 *
 * start_url is the internal path, not a tenant-prefixed one. It has to be: the
 * tenant segment is per-customer and this file is static. proxy.ts redirects
 * /dashboard to /{tenantSlug}/dashboard for a signed-in user and to /login
 * otherwise, so the installed icon lands in the right place either way.
 *
 * Icons are generated from assets/brand-masters/brand-mark.png (kept out of
 * public/ so the 729 KB master is never served). Neither is declared `maskable`:
 * they are contain-fitted to the full square, so an Android maskable crop would
 * cut into the mark. Add a separately padded file if that is ever wanted.
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
