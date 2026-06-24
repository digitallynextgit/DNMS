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
    <div className="flex flex-wrap items-center gap-3">
      {/* Employee search */}
      <div className="relative max-w-xs min-w-[180px] flex-1">
        <Input
          placeholder="Search employee..."
          value={employeeSearch}
          onChange={(e) => onEmployeeSearchChange(e.target.value)}
          className="h-9"
        />
      </div>

      {/* Month filter */}
      <Select value={month || "all"} onValueChange={(v) => onMonthChange(v === "all" ? "" : v)}>
        <SelectTrigger className="h-9 w-[150px]">
          <SelectValue placeholder="All Months" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Months</SelectItem>
          {MONTHS.map((m, i) => (
            <SelectItem key={i} value={String(i + 1)}>
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

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
      <Select value={status || "all"} onValueChange={(v) => onStatusChange(v === "all" ? "" : v)}>
        <SelectTrigger className="h-9 w-[150px]">
          <SelectValue placeholder="All Statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          {Object.entries(PAYROLL_STATUS_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Clear button */}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={onClear} className="h-9 gap-1.5">
          <X className="h-3.5 w-3.5" />
          Clear
        </Button>
      )}
    </div>
  )
}
