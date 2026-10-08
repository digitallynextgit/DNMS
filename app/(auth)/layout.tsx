import type { Metadata } from "next"

/**
 * Auth pages are doors, not search results (the root layout says index: true).
 * /signup overrides this back - it's a conversion page listed in sitemap.xml.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="bg-background h-dvh overflow-y-auto">{children}</div>
}
