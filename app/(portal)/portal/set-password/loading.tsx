import { Skeleton } from "@/components/ui/skeleton"

// Mirrors the AuthShell two-column layout: a dark brand panel on the left
// (desktop only) and a centered max-w-md form column on the right, so the real
// "Choose a password" form lands where this placeholder sits.
export default function SetPasswordLoading() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="hidden bg-neutral-950 lg:block" />

      <div className="flex items-center justify-center px-6 py-10 lg:px-12">
        <div className="w-full max-w-md">
          <div className="mb-6 space-y-2">
            <Skeleton className="bg-muted h-8 w-56 animate-pulse" />
            <Skeleton className="bg-muted h-4 w-72 animate-pulse" />
          </div>

          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2.5">
                <Skeleton className="bg-muted h-4 w-40 animate-pulse" />
                <Skeleton className="bg-muted h-11 w-full animate-pulse" />
              </div>
            ))}
            <Skeleton className="bg-muted h-11 w-full animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  )
}
