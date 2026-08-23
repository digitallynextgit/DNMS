import { PageHeaderSkeleton } from "@/components/shared/loading-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

/** Mirrors the create form: header + stacked section cards, each a title over a
 *  two-column field grid, so the page doesn't reflow when the form mounts. */
function FormCardSkeleton({ fields = 6 }: { fields?: number }) {
  return (
    <div className="border-border bg-card space-y-5 rounded-[2px] border p-6">
      <Skeleton className="bg-muted h-4 w-40 animate-pulse" />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="bg-muted h-3.5 w-24 animate-pulse" />
            <Skeleton className="bg-muted h-9 w-full animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function NewEmployeeLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <FormCardSkeleton fields={6} />
      <FormCardSkeleton fields={6} />
      <div className="flex justify-end gap-2">
        <Skeleton className="bg-muted h-9 w-24 animate-pulse" />
        <Skeleton className="bg-muted h-9 w-32 animate-pulse" />
      </div>
    </div>
  )
}
