import type { Metadata } from "next"
import "./globals.css"
import { Providers } from "@/components/providers/providers"

export const metadata: Metadata = {
  title: {
    template: "%s | DNMS",
    default: "DNMS - Digitally Next Management System",
  },
  description: "Modern DNMS for managing your workforce",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Theme-boot applies the saved palette before paint (no flash). Loaded as
            an external script (public/theme-boot.js) and render-blocking in <head>;
            React 19 only warns about INLINE scripts, not src ones. */}
        <script src="/theme-boot.js" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
