import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import NextTopLoader from "nextjs-toploader"
import "./globals.css"
import { Providers } from "@/components/providers/providers"
import { siteConfig } from "@/lib/site"

// Inter is a VARIABLE font: no weight array, so one woff2 covers every weight.
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
  // Only the public landing should be indexed.
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
  // A 180x180 derivative - iOS downloads the whole file just for a home-screen icon.
  icons: { icon: "/favicon.ico", shortcut: "/favicon.ico", apple: "/apple-touch-icon.png" },
  // No canonical here - every page would inherit it. Marketing pages set their own.
}

// Matches --background in globals.css; public/theme-boot.js applies the same palette before paint.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
}

// No auth() here: reading the session cookie would opt every route out of static prerendering.
// Authed route groups re-provide the session through <SessionBridge>.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Applies the saved palette before first paint (no flash). A src script, since React 19
            only warns about INLINE scripts. */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts -- blocking is the point: it must run before first paint */}
        <script src="/theme-boot.js" />
      </head>
      {/* suppressHydrationWarning: browser extensions stamp attributes onto <body> before
          hydration. Covers this element's attributes only. */}
      <body className="antialiased" suppressHydrationWarning>
        <NextTopLoader color="#ef4444" height={3} showSpinner={false} shadow="0 0 8px #ef4444" />
        <Providers session={null}>{children}</Providers>
      </body>
    </html>
  )
}
