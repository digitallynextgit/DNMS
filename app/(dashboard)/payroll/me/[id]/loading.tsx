import { Skeleton } from "@/components/ui/skeleton"

// A single payslip: a back button, title + status/download actions, then the
// A4-style payslip document (letterhead, employee grid, earnings table, net pay).
export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Header: back link, then title (left) and status + download (right). */}
      <div className="space-y-2 py-4">
        <Skeleton className="bg-muted h-8 w-24 animate-pulse rounded" />
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="bg-muted h-5 w-56 animate-pulse" />
          <div className="flex items-center gap-2">
            <Skeleton className="bg-muted h-5 w-20 animate-pulse rounded" />
            <Skeleton className="bg-muted h-9 w-32 animate-pulse rounded" />
          </div>
        </div>
      </div>

      <div className="bg-card rounded-[2px] border p-2 sm:p-4">
        <PayslipDocSkeleton />
      </div>
    </div>
  )
}

/** Placeholder shaped like the printed payslip document. */
function PayslipDocSkeleton() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="space-y-4 rounded-[2px] border border-neutral-300 px-6 py-5 dark:border-neutral-700">
        {/* Letterhead */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-16 w-16" />
        </div>

        {/* "Salary Slip - Month Year" */}
        <div className="flex justify-center border-t pt-3">
          <Skeleton className="h-4 w-48" />
        </div>

        {/* Employee detail grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3.5 flex-1" />
            </div>
          ))}
        </div>

        {/* Earnings / deductions table */}
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-full" />
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex gap-1.5">
              <Skeleton className="h-6 flex-1" />
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 w-24" />
            </div>
          ))}
        </div>

        {/* Net pay + amount in words */}
        <div className="space-y-2 border-t pt-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-3.5 w-72" />
        </div>
      </div>
    </div>
  )
}
