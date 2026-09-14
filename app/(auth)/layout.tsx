import type { Metadata } from "next"

/**
 * Sign-in, password reset and workspace switching are not search results: they
 * are doors, and an indexed door competes with the marketing page that should
 * have ranked instead. The root layout says `index: true` (correct for the
 * public site), so the gated groups have to say otherwise for themselves.
 *
 * /signup is the exception and overrides this back to indexable in its own page -
 * it is a conversion page and is listed in sitemap.xml.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="bg-background h-dvh overflow-y-auto">{children}</div>
}
