"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

/**
 * Group-level boundary for the CLIENT portal. External clients must never be
 * dumped onto the staff-styled root boundary: this keeps the failure inside the
 * portal frame, with wording written for a customer rather than an employee.
 */
export default function PortalError({
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
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="text-muted-foreground max-w-md text-sm">
        We couldn&apos;t load this page. Please try again - if it keeps happening, contact your
        account manager.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  )
}
