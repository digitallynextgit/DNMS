"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

/** Inside the (dashboard) layout, so one section failing keeps the sidebar and topbar. */
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
