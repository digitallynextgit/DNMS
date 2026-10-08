"use client"

import { FilterSelect, FilterToolbar } from "@/components/shared/filter-bar"
import { SearchInput } from "@/components/shared/search-input"
import { EMPLOYEE_STATUS_LABELS } from "@/lib/constants"
import { useDepartments } from "@/features/employees/hooks/use-employees"

// "Active" / "Inactive" match the directory's status badge (employee.isActive);
// the rest are the offboarding statuses.
const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  ...Object.entries(EMPLOYEE_STATUS_LABELS)
    .filter(([value]) => value !== "ACTIVE")
    .map(([value, label]) => ({ value, label })),
]

export interface EmployeeFiltersProps {
  search: string
  onSearchChange: (v: string) => void
  departmentId: string
  onDepartmentChange: (v: string) => void
  status: string
  onStatusChange: (v: string) => void
  onClear: () => void
}

export function EmployeeFilters({
  search,
  onSearchChange,
  departmentId,
  onDepartmentChange,
  status,
  onStatusChange,
  onClear,
}: EmployeeFiltersProps) {
  const { data: departmentsData } = useDepartments()
  const departments = departmentsData?.data ?? []

  // Active is the directory's default status, so it doesn't count as a filter.
  const hasActiveFilters = search !== "" || departmentId !== "" || status !== "ACTIVE"

  return (
    <FilterToolbar hasActiveFilters={hasActiveFilters} onClear={onClear}>
      <SearchInput
        placeholder="Search by name, email, or ID..."
        value={search}
        onChange={onSearchChange}
        className="max-w-sm min-w-[200px] flex-1"
      />

      <FilterSelect
        value={departmentId}
        onChange={onDepartmentChange}
        options={departments.map((dept) => ({ value: dept.id, label: dept.label }))}
        allLabel="All Departments"
        className="w-[180px]"
      />

      <FilterSelect
        value={status}
        onChange={onStatusChange}
        options={STATUS_OPTIONS}
        allLabel="All Statuses"
        className="w-[150px]"
      />
    </FilterToolbar>
  )
}
