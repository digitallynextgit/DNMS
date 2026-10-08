import { Skeleton } from "@/components/ui/skeleton"

export default function PortalActivityLoading() {
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Skeleton className="bg-muted h-6 w-32 animate-pulse" />
        <Skeleton className="bg-muted h-4 w-80 animate-pulse" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="bg-muted h-14 w-full animate-pulse rounded-sm" />
        ))}
      </div>
    </div>
  )
}
