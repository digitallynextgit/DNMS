import {
  PageHeaderSkeleton,
  StatCardSkeleton,
  ListSkeleton,
} from "@/components/shared/loading-skeleton"

// HR Holidays: header with tabs/year/add actions, a 3-up stat strip, then the
// default (table) tab's list. Mirrors the page's isLoading branch (ListSkeleton).
export default function HolidaysLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withActions />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      <ListSkeleton rows={6} height="h-14" />
    </div>
  )
}
