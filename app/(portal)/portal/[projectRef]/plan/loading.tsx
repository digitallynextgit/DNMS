import { Skeleton } from "@/components/ui/skeleton"

export default function PlanLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-16 rounded-sm" />
      <Skeleton className="h-64 rounded-sm" />
    </div>
  )
}
