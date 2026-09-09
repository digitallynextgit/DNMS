"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

export default function ProjectsError({
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
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <h2 className="text-lg font-semibold">Couldn&apos;t load projects</h2>
      <p className="text-muted-foreground text-sm">{error.message || "Please try again."}</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  )
}
