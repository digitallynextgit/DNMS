"use client"

import { Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { formatDate } from "@/lib/utils"
import { ATTENDANCE_STATUS_LABELS, ATTENDANCE_STATUS_COLORS } from "@/lib/constants"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyState } from "@/components/shared/empty-state"
import type { AttendanceLog } from "@/features/attendance/hooks/use-attendance"

interface AttendanceTableProps {
  logs: AttendanceLog[]
  isLoading: boolean
  canEdit?: boolean
  onEdit?: (log: AttendanceLog) => void
}

function formatTime(dt: string | null): string {
  if (!dt) return "-"
  return new Date(dt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
}

export function AttendanceTable({
  logs,
  isLoading,
  canEdit = false,
  onEdit,
}: AttendanceTableProps) {
  if (isLoading) {
    return (
      <div className="bg-card rounded border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 border-b">
              <th className="text-muted-foreground px-4 py-3 text-left font-medium">Employee</th>
              <th className="text-muted-foreground px-4 py-3 text-left font-medium">Date</th>
              <th className="text-muted-foreground px-4 py-3 text-left font-medium">Check In</th>
              <th className="text-muted-foreground px-4 py-3 text-left font-medium">Check Out</th>
              <th className="text-muted-foreground px-4 py-3 text-left font-medium">Work Hours</th>
              <th className="text-muted-foreground px-4 py-3 text-left font-medium">Status</th>
              {canEdit && (
                <th className="text-muted-foreground px-4 py-3 text-right font-medium">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y">
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="space-y-1">
                      <Skeleton className="h-3.5 w-28" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Skeleton className="h-3.5 w-24" />
                </td>
                <td className="px-4 py-3">
                  <Skeleton className="h-3.5 w-16" />
                </td>
                <td className="px-4 py-3">
                  <Skeleton className="h-3.5 w-16" />
                </td>
                <td className="px-4 py-3">
                  <Skeleton className="h-3.5 w-12" />
                </td>
                <td className="px-4 py-3">
                  <Skeleton className="h-5 w-16 rounded-full" />
                </td>
                {canEdit && <td className="px-4 py-3" />}
              </tr>
            ))}
          </tbody>
        </table>
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

  return (
    <div className="bg-card rounded border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/40 border-b">
            <th className="text-muted-foreground px-4 py-3 text-left font-medium">Employee</th>
            <th className="text-muted-foreground px-4 py-3 text-left font-medium">Date</th>
            <th className="text-muted-foreground px-4 py-3 text-left font-medium">Check In</th>
            <th className="text-muted-foreground px-4 py-3 text-left font-medium">Check Out</th>
            <th className="text-muted-foreground px-4 py-3 text-left font-medium">Work Hours</th>
            <th className="text-muted-foreground px-4 py-3 text-left font-medium">Status</th>
            {canEdit && (
              <th className="text-muted-foreground px-4 py-3 text-right font-medium">Actions</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y">
          {logs.map((log) => {
            const employee = log.employee
            const fullName = employee ? `${employee.firstName} ${employee.lastName}` : "Unknown"

            return (
              <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
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
                      {employee && (
                        <p className="text-muted-foreground text-xs">{employee.employeeNo}</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="text-muted-foreground px-4 py-3 whitespace-nowrap">
                  {formatDate(log.date)}
                </td>
                <td className="text-muted-foreground px-4 py-3">{formatTime(log.checkIn)}</td>
                <td className="text-muted-foreground px-4 py-3">{formatTime(log.checkOut)}</td>
                <td className="text-muted-foreground px-4 py-3">
                  {log.workHours !== null && log.workHours !== undefined
                    ? `${log.workHours}h`
                    : "-"}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge
                    status={log.status}
                    colorMap={ATTENDANCE_STATUS_COLORS}
                    labelMap={ATTENDANCE_STATUS_LABELS}
                  />
                  {log.isManual && (
                    <span className="text-muted-foreground ml-1.5 text-[10px] italic">manual</span>
                  )}
                </td>
                {canEdit && (
                  <td className="px-4 py-3 text-right">
                    {log.isManual && onEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onEdit(log)}
                        title="Edit attendance record"
                      >
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Edit</span>
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
