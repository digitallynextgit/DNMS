import { Skeleton } from "@/components/ui/skeleton"

// Mirrors the mailer page: custom heading, then the 4-tab bar and a content
// block the ProjectMailerTab renders (its own sections skeleton-load after).
export default function PortalMailerLoading() {
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Skeleton className="bg-muted h-6 w-44 animate-pulse" />
        <Skeleton className="bg-muted h-4 w-96 max-w-full animate-pulse" />
      </div>

      <div className="space-y-4">
        <div className="flex gap-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="bg-muted h-8 w-28 animate-pulse rounded-sm" />
          ))}
        </div>
        <Skeleton className="bg-muted h-64 w-full animate-pulse rounded-sm" />
      </div>
    </div>
  )
}
