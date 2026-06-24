"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative max-w-sm min-w-[200px] flex-1">
        <Input
          placeholder="Search by name, email, or ID..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-9"
        />
      </div>

      {/* Department Filter */}
      <Select
        value={departmentId || "all"}
        onValueChange={(v) => onDepartmentChange(v === "all" ? "" : v)}
      >
        <SelectTrigger className="h-9 w-[180px]">
          <SelectValue placeholder="All Departments" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Departments</SelectItem>
          {departments.map((dept) => (
            <SelectItem key={dept.id} value={dept.id}>
              {dept.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Status Filter */}
      <Select value={status || "all"} onValueChange={(v) => onStatusChange(v === "all" ? "" : v)}>
        <SelectTrigger className="h-9 w-[150px]">
          <SelectValue placeholder="All Statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          {Object.entries(EMPLOYEE_STATUS_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Clear filters button */}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={onClear} className="h-9 gap-1.5">
          <X className="h-3.5 w-3.5" />
          Clear
        </Button>
      )}
    </div>
  )
}
