import { Skeleton } from "@/components/ui/skeleton"
import { PageHeaderSkeleton } from "@/components/shared/loading-skeleton"

// Integrations: header (no actions) + a stack of settings-group cards
// (General, HR, mailers, etc.), each a titled card with a couple of fields.
export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="space-y-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border-border bg-card rounded-sm border">
            <div className="border-border flex items-center justify-between border-b px-6 py-4">
              <Skeleton className="bg-muted h-4 w-40 animate-pulse" />
              <Skeleton className="bg-muted h-8 w-20 animate-pulse" />
            </div>
            <div className="space-y-4 p-6">
              {Array.from({ length: 2 }).map((_, j) => (
                <div key={j} className="space-y-2">
                  <Skeleton className="bg-muted h-3.5 w-28 animate-pulse" />
                  <Skeleton className="bg-muted h-9 w-full animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
