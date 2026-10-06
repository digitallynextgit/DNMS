import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import NextTopLoader from "nextjs-toploader"
import "./globals.css"
import { Providers } from "@/components/providers/providers"
import { siteConfig } from "@/config/site"

// Self-hosted via next/font (no render-blocking Google Fonts request, no FOUT,
// no layout shift). Exposed as a CSS variable consumed by globals.css.
// NO `weight` array: Inter is a VARIABLE font, so omitting it emits ONE woff2
// covering every weight. Listing five static weights emitted seven files
// (~218 KB) of which only latin-400 was preloaded - each further weight was a
// separate late fetch that swapped text after first paint.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
})

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    template: "%s | DNMS",
    default: siteConfig.defaultTitle,
  },
  description: siteConfig.description,
  applicationName: siteConfig.fullName,
  keywords: [...siteConfig.keywords],
  authors: [{ name: siteConfig.company }],
  creator: siteConfig.company,
  publisher: siteConfig.company,
  // The dashboard/portal are gated apps; only the public landing should be
  // indexed. Per-route metadata under (dashboard)/(portal) can override, but the
  // proxy already blocks crawlers from reaching authed routes.
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    title: siteConfig.defaultTitle,
    description: siteConfig.description,
    url: siteConfig.url,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.defaultTitle,
    description: siteConfig.description,
  },
  // apple-touch-icon is a 180x180 derivative, not the 2505x2200 / 729 KB master:
  // iOS downloads this whole file just to draw a home-screen icon.
  icons: { icon: "/favicon.ico", shortcut: "/favicon.ico", apple: "/apple-touch-icon.png" },
  // NO canonical here. A canonical in the ROOT layout is inherited by every page
  // that does not set its own, which told search engines that /signup, /login and
  // every other un-overridden route were all duplicates of the homepage - while
  // sitemap.xml was simultaneously submitting /signup as a page in its own right.
  // The homepage sets `canonical: "/"` itself in (marketing)/page.tsx, as do the
  // other eight marketing pages.
}

// themeColor lives on `viewport`, not `metadata` (Next 14+). Matches
// --background in globals.css, so the browser chrome and the page agree in both
// schemes; public/theme-boot.js applies the same palette before first paint.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
}

// NO auth() here. Reading the session cookie in the ROOT layout opted every
// route in the app out of static prerendering - all nine marketing pages and
// /login were server-rendered per request because of that one line. The public
// pages render with session={null} (the marketing pages look it up themselves
// via useMarketingSession), and the authed route groups re-provide their layouts' server
// session through <SessionBridge> so permission-gated UI is still correct on
// first paint. See components/providers/session-bridge.tsx.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Theme-boot applies the saved palette before paint (no flash). Loaded as
            an external script (public/theme-boot.js) and render-blocking in <head>;
            React 19 only warns about INLINE scripts, not src ones. */}
        <script src="/theme-boot.js" />
      </head>
      {/* suppressHydrationWarning: browser extensions stamp attributes onto <body>
          before React hydrates (Bitdefender's `bis_register` /
          `__processed_<uuid>__`, password managers, Grammarly), and React reports
          the server/client attribute diff as a hydration mismatch. It is the
          extension, not our markup. This silences the warning for THIS element's
          attributes only - a genuine mismatch inside the tree still reports. */}
      <body className="antialiased" suppressHydrationWarning>
        {/* Navigation progress bar (perceived speed on route changes). */}
        <NextTopLoader color="#ef4444" height={3} showSpinner={false} shadow="0 0 8px #ef4444" />
        <Providers session={null}>{children}</Providers>
      </body>
    </html>
  )
}
