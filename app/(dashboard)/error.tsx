"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

/**
 * Group-level boundary for every dashboard section. Sitting INSIDE the
 * (dashboard) layout, it keeps the sidebar/topbar chrome when one section
 * throws - without it, an error anywhere fell through to the root app/error.tsx
 * and replaced the entire frame, so recovering meant losing your place.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <h2 className="text-xl font-semibold">This section hit a problem</h2>
      <p className="text-muted-foreground max-w-md text-sm">
        {error.message || "Please try again."}
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  )
}
