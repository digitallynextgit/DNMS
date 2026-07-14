import type { Metadata } from "next"
import { Inter } from "next/font/google"
import NextTopLoader from "nextjs-toploader"
import "./globals.css"
import { Providers } from "@/components/providers/providers"
import { auth } from "@/server/auth"

// Self-hosted via next/font (no render-blocking Google Fonts request, no FOUT,
// no layout shift). Exposed as a CSS variable consumed by globals.css.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-inter",
})

export const metadata: Metadata = {
  title: {
    template: "%s | DNMS",
    default: "DNMS - Digitally Next Management System",
  },
  description: "Modern DNMS for managing your workforce",
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Theme-boot applies the saved palette before paint (no flash). Loaded as
            an external script (public/theme-boot.js) and render-blocking in <head>;
            React 19 only warns about INLINE scripts, not src ones. */}
        <script src="/theme-boot.js" />
      </head>
      <body className="antialiased">
        {/* Navigation progress bar (perceived speed on route changes). */}
        <NextTopLoader color="#ef4444" height={3} showSpinner={false} shadow="0 0 8px #ef4444" />
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  )
}
