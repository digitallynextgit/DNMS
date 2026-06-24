"use client"

import { useEffect } from "react"

export default function AttendanceError({
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
      <h2 className="text-lg font-semibold">Couldn&apos;t load attendance</h2>
      <p className="text-muted-foreground text-sm">{error.message || "Please try again."}</p>
      <button
        onClick={reset}
        className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm"
      >
        Try again
      </button>
    </div>
  )
}
