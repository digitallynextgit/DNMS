"use client"

import { usePathname } from "next/navigation"
import { SessionProvider } from "next-auth/react"
import type { Session } from "next-auth"
import { ThemeProvider } from "next-themes"
import { QueryProvider } from "./query-provider"
import { CustomThemeApplier } from "./custom-theme-applier"
import { ExtensionHydrationFilter } from "./extension-hydration-filter"
import { Toaster } from "sonner"
import { isMarketingPath } from "@/lib/marketing-routes"

export function Providers({
  children,
  session,
}: {
  children: React.ReactNode
  /** Server-resolved session, so permission-gated UI is right on first paint (no pop-in). */
  session: Session | null
}) {
  const pathname = usePathname()
  // Marketing is dark-only; forcedTheme doesn't overwrite the user's stored dashboard preference.
  const forcedTheme = isMarketingPath(pathname) ? "dark" : undefined

  return (
    <SessionProvider session={session}>
      <ExtensionHydrationFilter />
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem
        disableTransitionOnChange={false}
        forcedTheme={forcedTheme}
      >
        <CustomThemeApplier />
        <QueryProvider>
          {children}
          <Toaster position="top-right" duration={3000} richColors closeButton theme="system" />
        </QueryProvider>
      </ThemeProvider>
    </SessionProvider>
  )
}
