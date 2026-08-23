import { Skeleton } from "@/components/ui/skeleton"

// Standalone project-picker landing (no app shell): mirrors the centered
// max-w-3xl column - logo, welcome heading, then a 2-up grid of project cards.
export default function PortalHomeLoading() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Skeleton className="bg-muted mb-10 h-9 w-44 animate-pulse" />

      <div className="mb-6 space-y-2">
        <Skeleton className="bg-muted h-6 w-56 animate-pulse" />
        <Skeleton className="bg-muted h-4 w-72 animate-pulse" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card space-y-3 rounded-sm border p-4">
            <Skeleton className="bg-muted h-4 w-2/3 animate-pulse" />
            <Skeleton className="bg-muted h-3 w-1/2 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}
