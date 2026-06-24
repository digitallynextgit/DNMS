"use client"

import { Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn, formatDate, getInitials, getAvatarColor } from "@/lib/utils"
import { ATTENDANCE_STATUS_LABELS, ATTENDANCE_STATUS_COLORS } from "@/lib/constants"
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
      <div className="bg-card flex flex-col items-center justify-center rounded border py-20 text-center">
        <p className="text-muted-foreground text-sm">No attendance records found.</p>
        <p className="text-muted-foreground mt-1 text-xs">
          Try adjusting your filters or adding a manual record.
        </p>
      </div>
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
            const initials = employee ? getInitials(employee.firstName, employee.lastName) : "?"
            const avatarBg = getAvatarColor(fullName)
            const statusColor = ATTENDANCE_STATUS_COLORS[log.status] ?? "bg-gray-100 text-gray-700"
            const statusLabel = ATTENDANCE_STATUS_LABELS[log.status] ?? log.status

            return (
              <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8 shrink-0">
                      {employee?.profilePhoto ? (
                        <AvatarImage src={employee.profilePhoto} alt={fullName} />
                      ) : null}
                      <AvatarFallback className={cn("text-xs font-semibold text-white", avatarBg)}>
                        {initials}
                      </AvatarFallback>
                    </Avatar>
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
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                      statusColor,
                    )}
                  >
                    {statusLabel}
                  </span>
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
