"use client"

import { FilterSelect, FilterToolbar } from "@/components/shared/filter-bar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SearchInput } from "@/components/shared/search-input"
import { ATTENDANCE_STATUS_LABELS } from "@/lib/constants"

export interface AttendanceFiltersProps {
  employeeSearch: string
  onEmployeeSearchChange: (v: string) => void
  dateFrom: string
  onDateFromChange: (v: string) => void
  dateTo: string
  onDateToChange: (v: string) => void
  status: string
  onStatusChange: (v: string) => void
  onClear: () => void
}

export function AttendanceFilters({
  employeeSearch,
  onEmployeeSearchChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  status,
  onStatusChange,
  onClear,
}: AttendanceFiltersProps) {
  const hasActiveFilters =
    employeeSearch !== "" || dateFrom !== "" || dateTo !== "" || status !== ""

  return (
    <FilterToolbar hasActiveFilters={hasActiveFilters} onClear={onClear} className="items-end">
      {/* Employee search */}
      <div className="flex max-w-xs min-w-[180px] flex-1 flex-col gap-1.5">
        <Label className="text-muted-foreground text-xs">Employee</Label>
        <SearchInput
          placeholder="Search by name or ID..."
          value={employeeSearch}
          onChange={onEmployeeSearchChange}
        />
      </div>

      {/* Date from */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-muted-foreground text-xs">From</Label>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFromChange(e.target.value)}
          className="h-9 w-[150px]"
        />
      </div>

      {/* Date to */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-muted-foreground text-xs">To</Label>
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => onDateToChange(e.target.value)}
          className="h-9 w-[150px]"
        />
      </div>

      {/* Status filter */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-muted-foreground text-xs">Status</Label>
        <FilterSelect
          value={status}
          onChange={onStatusChange}
          options={Object.entries(ATTENDANCE_STATUS_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
          allLabel="All Statuses"
          className="w-[140px]"
        />
      </div>
    </FilterToolbar>
  )
}
