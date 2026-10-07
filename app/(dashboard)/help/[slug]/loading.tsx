import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="max-w-3xl space-y-4">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="aspect-[16/9] w-full" />
      </div>
    </div>
  )
}
