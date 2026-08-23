import { Skeleton } from "@/components/ui/skeleton"

// Payroll record detail: back + title/description + download, a status row, the
// printed payslip document, then a 2-up grid of HR breakdown cards (Attendance,
// Earnings, Deductions, Net Pay).
export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Header: back link, title + description (left), download (right). */}
      <div className="space-y-2 py-4">
        <Skeleton className="bg-muted h-8 w-32 animate-pulse rounded" />
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="bg-muted h-5 w-56 animate-pulse" />
            <Skeleton className="bg-muted h-4 w-56 animate-pulse" />
          </div>
          <Skeleton className="bg-muted h-9 w-32 animate-pulse rounded" />
        </div>
      </div>

      {/* Status row */}
      <div className="flex items-center gap-3">
        <Skeleton className="bg-muted h-5 w-20 animate-pulse rounded" />
      </div>

      {/* Payslip document */}
      <div className="bg-card rounded-[2px] border p-2 sm:p-4">
        <PayslipDocSkeleton />
      </div>

      {/* HR breakdown cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <BreakdownCard rows={4} />
        <BreakdownCard rows={7} />
        <BreakdownCard rows={2} />
        <NetPayCard />
      </div>
    </div>
  )
}

function BreakdownCard({ rows }: { rows: number }) {
  return (
    <div className="border-border bg-card rounded-[2px] border p-5">
      <Skeleton className="bg-muted mb-4 h-4 w-24 animate-pulse" />
      <div className="space-y-1">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex justify-between py-1.5">
            <Skeleton className="bg-muted h-4 w-32 animate-pulse" />
            <Skeleton className="bg-muted h-4 w-16 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}

function NetPayCard() {
  return (
    <div className="border-border bg-card rounded-[2px] border p-5">
      <Skeleton className="bg-muted mb-4 h-4 w-20 animate-pulse" />
      <Skeleton className="bg-muted h-8 w-36 animate-pulse" />
    </div>
  )
}

/** Placeholder shaped like the printed payslip document. */
function PayslipDocSkeleton() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="space-y-4 rounded-[2px] border border-neutral-300 px-6 py-5 dark:border-neutral-700">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-16 w-16" />
        </div>
        <div className="flex justify-center border-t pt-3">
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3.5 flex-1" />
            </div>
          ))}
        </div>
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
        <div className="space-y-2 border-t pt-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-3.5 w-72" />
        </div>
      </div>
    </div>
  )
}
