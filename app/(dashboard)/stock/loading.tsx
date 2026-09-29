import {
  PageHeaderSkeleton,
  CardGridSkeleton,
  ListSkeleton,
} from "@/components/shared/loading-skeleton"

// Stock register: header + item cards + the issues table.
export default function StockLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withActions />
      <CardGridSkeleton count={5} />
      <ListSkeleton rows={8} height="h-12" />
    </div>
  )
}
