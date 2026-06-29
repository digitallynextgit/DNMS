"use client"

import { useState } from "react"
import {
  CheckCircle2,
  XCircle,
  Clock,
  Timer,
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { Button } from "@/components/ui/button"
import { useMyAttendanceCalendar, useSyncAttendance } from "@/features/attendance"
import { AttendanceCalendar } from "@/features/attendance/components/attendance-calendar"

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

export default function MyAttendancePage() {
  const now = new Date()
  const curY = now.getFullYear()
  const curM = now.getMonth() + 1 // 1-12

  const [year, setYear] = useState(curY)
  const [month, setMonth] = useState(curM)

  const { data, isLoading } = useMyAttendanceCalendar(year, month)
  const sync = useSyncAttendance()

  const days = data?.data.days ?? []
  const firstPunch = data?.data.firstPunchDate ?? null // "YYYY-MM-DD"
  const firstY = firstPunch ? Number(firstPunch.slice(0, 4)) : null
  const firstM = firstPunch ? Number(firstPunch.slice(5, 7)) : null

  // Bound navigation: not before the first punch month, not after the current month.
  const canPrev =
    firstY !== null && firstM !== null && (year > firstY || (year === firstY && month > firstM))
  const canNext = year < curY || (year === curY && month < curM)

  function prev() {
    if (!canPrev) return
    if (month === 1) {
      setMonth(12)
      setYear((y) => y - 1)
    } else setMonth((m) => m - 1)
  }
  function next() {
    if (!canNext) return
    if (month === 12) {
      setMonth(1)
      setYear((y) => y + 1)
    } else setMonth((m) => m + 1)
  }

  // Summary for the SELECTED month.
  const presentDays = days.filter((d) => d.status === "PRESENT").length
  const absentDays = days.filter((d) => d.status === "ABSENT").length
  const halfDays = days.filter((d) => d.status === "HALF_DAY").length
  const worked = days.filter((d) => d.workHours != null && d.workHours > 0)
  const totalHours = worked.reduce((sum, d) => sum + (d.workHours ?? 0), 0)
  const avgHours = worked.length > 0 ? Math.round((totalHours / worked.length) * 10) / 10 : 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Attendance"
        description={`${MONTHS[month - 1]} ${year}`}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => sync.mutate()}
              disabled={sync.isPending}
              title="Pull the latest punches from the attendance device"
            >
              {sync.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Refresh
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={prev}
              disabled={!canPrev || isLoading}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={next}
              disabled={!canNext || isLoading}
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        }
      />

      {/* Summary cards (selected month) */}
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
        <StatCard
          title="Avg Work Hours"
          value={isLoading ? "-" : `${avgHours}h`}
          icon={Timer}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
          description="Per working day"
        />
      </div>

      {/* Calendar (selected month) */}
      {isLoading ? (
        <div className="bg-card flex h-72 items-center justify-center rounded-lg border">
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        </div>
      ) : (
        <AttendanceCalendar days={days} />
      )}
    </div>
  )
}
