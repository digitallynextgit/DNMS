"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/page-header"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"

// Placeholders sized like the directory's real cells, so nothing jumps when data lands.

/** The identity cell: avatar, name, employee number. */
export function EmployeeCellSkeleton() {
  return (
    <div className="flex items-center gap-3">
      <Skeleton className="h-8 w-8 shrink-0 rounded-sm" />
      <div>
        <div className="flex h-5 items-center">
          <Skeleton className="h-3.5 w-32" />
        </div>
        <div className="flex h-4 items-center">
          <Skeleton className="h-3 w-10" />
        </div>
      </div>
    </div>
  )
}

export function EmployeeStatusSkeleton() {
  return <Skeleton className="h-5 w-14 rounded-sm" />
}

/** The row's icon buttons (view + deactivate): 36px each, a small glyph inside. */
export function EmployeeActionsSkeleton() {
  return (
    <div className="flex items-center justify-end gap-1">
      {[0, 1].map((i) => (
        <div key={i} className="flex h-9 w-9 items-center justify-center">
          <Skeleton className="h-4 w-4" />
        </div>
      ))}
    </div>
  )
}

// Mirrors the columns in employee-directory-client.tsx (cells never render while loading).
const COLUMNS: DataTableColumn<never>[] = [
  { header: "Employee", cell: () => null, skeleton: <EmployeeCellSkeleton /> },
  { header: "Department", cell: () => null },
  { header: "Designation", cell: () => null },
  { header: "Status", cell: () => null, skeleton: <EmployeeStatusSkeleton /> },
  { header: "Joined", cell: () => null },
  { header: "", align: "right", cell: () => null, skeleton: <EmployeeActionsSkeleton /> },
]

/** The select-all checkbox column, inert until the page itself mounts. */
const NO_SELECTION = {
  isSelected: () => false,
  toggle: () => {},
  toggleAll: () => {},
  allSelected: false,
  someSelected: false,
}

/** The directory page while the route loads, at its real layout. */
export function EmployeeDirectorySkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Employees"
        description={<Skeleton className="h-4 w-36" />}
        actions={<Skeleton className="h-9 w-36" />}
      />

      <div className="flex flex-wrap items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          <Skeleton className="h-9 max-w-sm min-w-[200px] flex-1" />
          <Skeleton className="h-9 w-[180px]" />
          <Skeleton className="h-9 w-[150px]" />
        </div>
        <Skeleton className="h-9 w-[82px]" />
      </div>

      <DataTable
        columns={COLUMNS}
        rows={[]}
        rowKey={() => ""}
        showSerial
        selection={NO_SELECTION}
        loading
        skeletonRows={10}
      />
    </div>
  )
}
