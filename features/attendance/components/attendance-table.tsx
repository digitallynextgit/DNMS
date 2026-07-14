"use client"

import { Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { formatDate } from "@/lib/utils"
import { ATTENDANCE_STATUS_LABELS, ATTENDANCE_STATUS_COLORS } from "@/lib/constants"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyState } from "@/components/shared/empty-state"
import {
  DataTable,
  type DataTableColumn,
  type DataTableSelection,
} from "@/components/shared/data-table"
import type { AttendanceLog } from "@/features/attendance/hooks/use-attendance"

interface AttendanceTableProps {
  logs: AttendanceLog[]
  isLoading: boolean
  canEdit?: boolean
  onEdit?: (log: AttendanceLog) => void
  /** Render the leading auto-numbered S.No column (default on). */
  showSerial?: boolean
  /** Offset for the S.No when the parent paginates, e.g. (page - 1) * pageSize. */
  serialOffset?: number
  /** Optional multi-select wiring - pass `useRowSelection(pageIds)` to enable checkboxes. */
  selection?: DataTableSelection
}

function formatTime(dt: string | null): string {
  if (!dt) return "-"
  return new Date(dt).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  })
}

export function AttendanceTable({
  logs,
  isLoading,
  canEdit = false,
  onEdit,
  showSerial = true,
  serialOffset = 0,
  selection,
}: AttendanceTableProps) {
  if (isLoading) {
    return (
      <div className="bg-card rounded-lg border">
        <div className="space-y-2 p-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <EmptyState
        variant="card"
        title="No attendance records found."
        description="Try adjusting your filters or adding a manual record."
      />
    )
  }

  const columns: DataTableColumn<AttendanceLog>[] = [
    {
      header: "Employee",
      cell: (log) => {
        const employee = log.employee
        const fullName = employee ? `${employee.firstName} ${employee.lastName}` : "Unknown"
        return (
          <div className="flex items-center gap-3">
            <AvatarDisplay
              src={employee?.profilePhoto}
              firstName={employee?.firstName ?? "?"}
              lastName={employee?.lastName ?? ""}
              size="sm"
              className="shrink-0"
            />
            <div className="min-w-0">
              <p className="truncate font-medium">{fullName}</p>
              {employee && <p className="text-muted-foreground text-xs">{employee.employeeNo}</p>}
            </div>
          </div>
        )
      },
    },
    {
      header: "Date",
      className: "text-muted-foreground whitespace-nowrap",
      cell: (log) => formatDate(log.date),
    },
    {
      header: "Check In",
      className: "text-muted-foreground",
      cell: (log) => formatTime(log.checkIn),
    },
    {
      header: "Check Out",
      className: "text-muted-foreground",
      cell: (log) => formatTime(log.checkOut),
    },
    {
      header: "Work Hours",
      className: "text-muted-foreground",
      cell: (log) =>
        log.workHours !== null && log.workHours !== undefined ? `${log.workHours}h` : "-",
    },
    {
      header: "Status",
      cell: (log) => (
        <>
          <StatusBadge
            status={log.status}
            colorMap={ATTENDANCE_STATUS_COLORS}
            labelMap={ATTENDANCE_STATUS_LABELS}
          />
          {log.isManual && (
            <span className="text-muted-foreground ml-1.5 text-[10px] italic">manual</span>
          )}
        </>
      ),
    },
    ...(canEdit
      ? [
          {
            header: "Actions",
            align: "right" as const,
            cell: (log: AttendanceLog) =>
              log.isManual && onEdit ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onEdit(log)}
                  title="Edit attendance record"
                >
                  <Pencil className="h-4 w-4" />
                  <span className="sr-only">Edit</span>
                </Button>
              ) : null,
          },
        ]
      : []),
  ]

  return (
    <DataTable
      columns={columns}
      rows={logs}
      rowKey={(log) => log.id}
      minWidth="min-w-[760px]"
      showSerial={showSerial}
      serialOffset={serialOffset}
      selection={selection}
    />
  )
}
