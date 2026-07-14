"use client"

import { useEffect } from "react"

export default function GlobalError({
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
    <html lang="en">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
          <h2 className="text-xl font-semibold">Something went wrong</h2>
          <p className="text-sm text-gray-500">{error.message || "Please try again."}</p>
          <button onClick={reset} className="rounded bg-black px-4 py-2 text-sm text-white">
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
