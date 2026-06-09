"use client"

import { useState } from "react"
import { CheckCircle2, XCircle, Clock, Timer } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { cn, formatDate } from "@/lib/utils"
import { ATTENDANCE_STATUS_LABELS, ATTENDANCE_STATUS_COLORS } from "@/lib/constants"
import { useMyAttendance } from "@/hooks/use-attendance"

function formatTime(dt: string | null): string {
  if (!dt) return "-"
  return new Date(dt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

export default function MyAttendancePage() {
  const [page, setPage] = useState(1)

  const { data, isLoading } = useMyAttendance({ days: 30, page, limit: 30 })

  const logs = data?.data ?? []
  const pagination = data?.pagination

  // Summary cards
  const presentDays = logs.filter((l) => l.status === "PRESENT").length
  const absentDays = logs.filter((l) => l.status === "ABSENT").length
  const halfDays = logs.filter((l) => l.status === "HALF_DAY").length
  // Late-mark tracking disabled for now (do not delete):
  // const lateDays = logs.filter((l) => l.status === "LATE").length
  const workingLogs = logs.filter(
    (l) => l.workHours !== null && l.workHours !== undefined && l.workHours > 0,
  )
  const totalHours = workingLogs.reduce((sum, l) => sum + (l.workHours ?? 0), 0)
  const avgHours =
    workingLogs.length > 0 ? Math.round((totalHours / workingLogs.length) * 10) / 10 : 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Attendance"
        description="Your attendance records for the last 30 days"
      />

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Present Days"
          value={isLoading ? "-" : presentDays}
          icon={CheckCircle2}
          iconColor="text-green-600"
          iconBg="bg-green-50"
        />
        <StatCard
          title="Absent Days"
          value={isLoading ? "-" : absentDays}
          icon={XCircle}
          iconColor="text-red-600"
          iconBg="bg-red-50"
        />
        <StatCard
          title="Half Days"
          value={isLoading ? "-" : halfDays}
          icon={Clock}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
        />
        {/* Late-mark tracking disabled for now (do not delete):
        <StatCard
          title="Late Days"
          value={isLoading ? "-" : lateDays}
          icon={Clock}
          iconColor="text-orange-600"
          iconBg="bg-orange-50"
        /> */}
        <StatCard
          title="Avg Work Hours"
          value={isLoading ? "-" : `${avgHours}h`}
          icon={Timer}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
          description="Per working day"
        />
      </div>

      {/* Attendance list */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-card flex flex-col items-center justify-center rounded border py-20 text-center">
          <p className="text-muted-foreground text-sm">
            No attendance records found for the last 30 days.
          </p>
        </div>
      ) : (
        <div className="bg-card divide-y overflow-hidden rounded border">
          {logs.map((log) => {
            const statusColor = ATTENDANCE_STATUS_COLORS[log.status] ?? "bg-gray-100 text-gray-700"
            const statusLabel = ATTENDANCE_STATUS_LABELS[log.status] ?? log.status

            return (
              <div
                key={log.id}
                className="hover:bg-muted/20 flex items-center justify-between px-5 py-4 transition-colors"
              >
                {/* Date */}
                <div className="min-w-[110px]">
                  <p className="text-sm font-medium">{formatDate(log.date, "EEE, dd MMM")}</p>
                  <p className="text-muted-foreground text-xs">{formatDate(log.date, "yyyy")}</p>
                </div>

                {/* Check in / out */}
                <div className="text-muted-foreground flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-1.5">
                    <span className="text-foreground/60 text-xs font-medium">IN</span>
                    <span>{formatTime(log.checkIn)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-foreground/60 text-xs font-medium">OUT</span>
                    <span>{formatTime(log.checkOut)}</span>
                  </div>
                </div>

                {/* Work hours */}
                <div className="text-muted-foreground min-w-[60px] text-right text-sm">
                  {log.workHours !== null && log.workHours !== undefined
                    ? `${log.workHours}h`
                    : "-"}
                </div>

                {/* Status */}
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                    statusColor,
                  )}
                >
                  {statusLabel}
                </span>

                {/* Notes */}
                {log.notes && (
                  <p className="text-muted-foreground hidden max-w-[140px] truncate text-xs sm:block">
                    {log.notes}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            Page {pagination.page} of {pagination.totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
