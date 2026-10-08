import { PageHeaderSkeleton, ListSkeleton } from "@/components/shared/loading-skeleton"

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton />
      <ListSkeleton rows={5} height="h-20" />
    </div>
  )
}
