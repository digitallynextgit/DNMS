"use client"

import { SessionProvider } from "next-auth/react"
import type { Session } from "next-auth"
import { ThemeProvider } from "next-themes"
import { QueryProvider } from "./query-provider"
import { CustomThemeApplier } from "./custom-theme-applier"
import { ExtensionHydrationFilter } from "./extension-hydration-filter"
import { Toaster } from "sonner"

export function Providers({
  children,
  session,
}: {
  children: React.ReactNode
  /**
   * Server-resolved session. Without it, next-auth fires a client-side
   * GET /api/auth/session on mount - and until that lands, `usePermissions().can()`
   * returns false for everything, so every permission-gated button (nav items,
   * "Add Employee", edit/delete icons) renders ABSENT and then pops in. Passing it
   * makes permissions correct on the very first paint.
   */
  session: Session | null
}) {
  return (
    <SessionProvider session={session}>
      {/* Dev-only: drops hydration warnings caused by browser extensions
          (Bitdefender's bis_skin_checked et al). Our own mismatches still log. */}
      <ExtensionHydrationFilter />
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem
        disableTransitionOnChange={false}
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
