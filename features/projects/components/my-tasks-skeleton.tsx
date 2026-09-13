import { Fragment } from "react"
import { PageHeader } from "@/components/shared/page-header"
import { StatStrip } from "@/components/shared/stat-strip"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

const STICKY_EDGE = "sticky left-0 border-r-2 shadow-[4px_0_6px_-4px_rgb(0_0_0/0.45)]"

export function MyTasksSheetSkeleton() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"]

  return (
    <div className="space-y-3">
      {/* Week stepper */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded-sm" />
          <Skeleton className="h-4 w-36" />
        </div>
        <div className="flex items-center gap-1">
          <Skeleton className="h-8 w-8 rounded-sm" />
          <Skeleton className="h-8 w-20 rounded-sm" />
          <Skeleton className="h-8 w-8 rounded-sm" />
        </div>
      </div>

      {/* Sheet Table Grid */}
      <div className="bg-card overflow-x-auto rounded-sm border">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="bg-muted/60">
              <th
                rowSpan={2}
                className={cn(
                  "bg-muted z-20 w-32 min-w-32 sm:w-44 sm:min-w-44 border-b px-3 py-2 text-left text-[11px] font-semibold tracking-wide uppercase",
                  STICKY_EDGE,
                )}
              >
                Client
              </th>
              {days.map((day) => (
                <th
                  key={day}
                  colSpan={4}
                  className="border-r border-b px-3 py-1.5 text-center text-[11px] font-semibold tracking-wide uppercase"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>{day}</span>
                    <Skeleton className="h-3 w-10" />
                  </div>
                </th>
              ))}
              <th
                rowSpan={2}
                className="w-24 border-b px-2 py-2 text-center text-[11px] font-semibold tracking-wide uppercase"
              >
                Week total
              </th>
            </tr>
            <tr className="bg-muted/40 text-muted-foreground text-[10px] tracking-wide uppercase">
              {days.map((day) => (
                <Fragment key={day}>
                  <th className="min-w-36 border-r border-b px-3 py-1 text-left font-medium">Plan</th>
                  <th className="min-w-36 border-r border-b px-3 py-1 text-left font-medium">Actual</th>
                  <th className="w-16 min-w-16 border-r border-b px-2 py-1 text-right font-medium">Hrs</th>
                  <th className="w-28 min-w-28 border-r border-b px-2 py-1 text-left font-medium">Resources</th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }).map((_, rIdx) => (
              <tr key={rIdx} className="align-top">
                <th
                  scope="row"
                  className={cn(
                    "bg-card z-10 border-b px-3 py-2.5 text-left align-top",
                    STICKY_EDGE,
                  )}
                >
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="mt-1 h-2.5 w-14" />
                </th>
                {days.map((day) => (
                  <Fragment key={day}>
                    <td className="border-r border-b p-2">
                      <div className="space-y-1">
                        <Skeleton className="h-3 w-20" />
                        {rIdx % 2 === 0 && <Skeleton className="h-3 w-28" />}
                      </div>
                    </td>
                    <td className="border-r border-b p-2">
                      {rIdx % 2 === 0 ? <Skeleton className="h-3 w-16" /> : null}
                    </td>
                    <td className="border-r border-b p-2 text-right">
                      {rIdx % 2 === 0 ? <Skeleton className="h-3 w-8 ml-auto" /> : null}
                    </td>
                    <td className="border-r border-b p-2">
                      {rIdx % 3 === 0 ? <Skeleton className="h-3 w-12" /> : null}
                    </td>
                  </Fragment>
                ))}
                <td className="border-b p-2 text-center">
                  <Skeleton className="h-3 w-8 mx-auto" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}


export function MyTasksFullSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="My Tasks"
        description="Tasks assigned to you across all projects."
        actions={
          <>
            <Skeleton className="h-9 w-20 rounded-sm" />
            <Skeleton className="h-9 w-44 rounded-sm" />
            <Skeleton className="h-9 w-24 rounded-sm" />
          </>
        }
      />

      <StatStrip
        loading={true}
        items={[
          { label: "Total", value: 0 },
          { label: "Done", value: 0 },
          { label: "Overdue", value: 0 },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-xs">Project:</span>
          <Skeleton className="h-8 w-48 rounded-sm" />
          <span className="text-muted-foreground ml-1 text-xs">Status:</span>
          <Skeleton className="h-8 w-36 rounded-sm" />
        </div>
        <Skeleton className="h-8 w-20 rounded-sm" />
      </div>

      <MyTasksSheetSkeleton />
    </div>
  )
}

