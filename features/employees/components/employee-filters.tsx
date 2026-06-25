"use client"

import { FilterSelect, FilterToolbar } from "@/components/shared/filter-bar"
import { SearchInput } from "@/components/shared/search-input"
import { EMPLOYEE_STATUS_LABELS } from "@/lib/constants"
import { useDepartments } from "@/features/employees/hooks/use-employees"

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

  const hasActiveFilters = search !== "" || departmentId !== "" || status !== ""

  return (
    <FilterToolbar hasActiveFilters={hasActiveFilters} onClear={onClear}>
      {/* Search */}
      <SearchInput
        placeholder="Search by name, email, or ID..."
        value={search}
        onChange={onSearchChange}
        className="max-w-sm min-w-[200px] flex-1"
      />

      {/* Department Filter */}
      <FilterSelect
        value={departmentId}
        onChange={onDepartmentChange}
        options={departments.map((dept) => ({ value: dept.id, label: dept.name }))}
        allLabel="All Departments"
        className="w-[180px]"
      />

      {/* Status Filter */}
      <FilterSelect
        value={status}
        onChange={onStatusChange}
        options={Object.entries(EMPLOYEE_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
        allLabel="All Statuses"
        className="w-[150px]"
      />
    </FilterToolbar>
  )
}
