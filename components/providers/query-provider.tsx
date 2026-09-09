"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"

import { toastError } from "@/lib/error-message"

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
          mutations: {
            // Safety net: a mutation that fails without its own `onError` still
            // tells the user why. A hook-level `onError` replaces this default,
            // so mutations that already toast are unaffected (no double toast).
            onError: (error) => toastError(error),
          },
        },
      }),
  )

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
