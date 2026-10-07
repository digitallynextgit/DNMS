import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-8 w-36" />
      </div>
      <Skeleton className="h-9 w-full sm:max-w-md" />
      <div className="space-y-3">
        <Skeleton className="h-5 w-40" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-[76px] w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}
