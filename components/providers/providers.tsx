"use client"

import { SessionProvider } from "next-auth/react"
import { ThemeProvider } from "next-themes"
import { QueryProvider } from "./query-provider"
import { CustomThemeApplier } from "./custom-theme-applier"
import { Toaster } from "sonner"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
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
