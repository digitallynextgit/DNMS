"use client"

import { FilterSelect, FilterToolbar } from "@/components/shared/filter-bar"
import { Input } from "@/components/ui/input"
import { SearchInput } from "@/components/shared/search-input"
import { MONTHS, PAYROLL_STATUS_LABELS } from "@/lib/constants"

export interface PayrollFiltersProps {
  month: string
  onMonthChange: (v: string) => void
  year: string
  onYearChange: (v: string) => void
  status: string
  onStatusChange: (v: string) => void
  employeeSearch: string
  onEmployeeSearchChange: (v: string) => void
  onClear: () => void
}

export function PayrollFilters({
  month,
  onMonthChange,
  year,
  onYearChange,
  status,
  onStatusChange,
  employeeSearch,
  onEmployeeSearchChange,
  onClear,
}: PayrollFiltersProps) {
  const hasActiveFilters = month !== "" || year !== "" || status !== "" || employeeSearch !== ""

  return (
    <FilterToolbar hasActiveFilters={hasActiveFilters} onClear={onClear}>
      {/* Employee search */}
      <SearchInput
        value={employeeSearch}
        onChange={onEmployeeSearchChange}
        placeholder="Search employee..."
        className="max-w-xs min-w-[180px] flex-1"
      />

      {/* Month filter */}
      <FilterSelect
        value={month}
        onChange={onMonthChange}
        options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))}
        allLabel="All Months"
        className="w-[150px]"
      />

      {/* Year input */}
      <Input
        type="number"
        placeholder="Year"
        value={year}
        min={2020}
        max={2099}
        onChange={(e) => onYearChange(e.target.value)}
        className="h-9 w-[100px]"
      />

      {/* Status filter */}
      <FilterSelect
        value={status}
        onChange={onStatusChange}
        options={Object.entries(PAYROLL_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
        allLabel="All Statuses"
        className="w-[150px]"
      />
    </FilterToolbar>
  )
}
