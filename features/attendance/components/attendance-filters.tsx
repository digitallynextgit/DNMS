"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
    <div className="flex flex-wrap items-end gap-3">
      {/* Employee search */}
      <div className="flex max-w-xs min-w-[180px] flex-1 flex-col gap-1.5">
        <Label className="text-muted-foreground text-xs">Employee</Label>
        <Input
          placeholder="Search by name or ID..."
          value={employeeSearch}
          onChange={(e) => onEmployeeSearchChange(e.target.value)}
          className="h-9"
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
        <Select value={status || "all"} onValueChange={(v) => onStatusChange(v === "all" ? "" : v)}>
          <SelectTrigger className="h-9 w-[140px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(ATTENDANCE_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Clear button */}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={onClear} className="h-9 gap-1.5 self-end">
          <X className="h-3.5 w-3.5" />
          Clear
        </Button>
      )}
    </div>
  )
}
