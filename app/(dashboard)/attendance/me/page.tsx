"use client"

import { useState } from "react"
import { Spinner } from "@/components/shared/spinner"
import { CheckCircle2, AlertTriangle, Clock, Timer } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { MonthNav, MONTH_NAMES } from "@/components/shared/month-nav"
import { useMyAttendanceCalendar } from "@/features/attendance"
import { AttendanceCalendar } from "@/features/attendance/components/attendance-calendar"
import { formatWorkHours } from "@/lib/utils"

export default function MyAttendancePage() {
  const now = new Date()
  const curY = now.getFullYear()
  const curM = now.getMonth() + 1 // 1-12

  const [year, setYear] = useState(curY)
  const [month, setMonth] = useState(curM)

  const { data, isLoading } = useMyAttendanceCalendar(year, month)

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
  const missingPunchDays = days.filter((d) => d.status === "MISSING_PUNCH").length
  const halfDays = days.filter((d) => d.status === "HALF_DAY").length
  const worked = days.filter((d) => d.workHours != null && d.workHours > 0)
  const totalHours = worked.reduce((sum, d) => sum + (d.workHours ?? 0), 0)
  const avgHours = worked.length > 0 ? totalHours / worked.length : 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Attendance"
        description={`${MONTH_NAMES[month - 1]} ${year}`}
        actions={
          <>
            {/* No device "Refresh" here: pulling punches is an HR/admin action (see
                Attendance Directory). Employees just read their own calendar, which
                the scheduled sync keeps current. */}
            {/* The header already prints the month, so the stepper is arrows only. */}
            <MonthNav
              year={year}
              month={month - 1}
              onPrev={prev}
              onNext={next}
              canPrev={canPrev && !isLoading}
              canNext={canNext && !isLoading}
              showLabel={false}
            />
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
          title="Missing Punch"
          value={isLoading ? "-" : missingPunchDays}
          icon={AlertTriangle}
          iconColor="text-purple-600"
          iconBg="bg-purple-50"
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
          value={isLoading ? "-" : formatWorkHours(avgHours)}
          icon={Timer}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
          description="Per working day"
        />
      </div>

      {/* Calendar (selected month) */}
      {isLoading ? (
        <div className="bg-card flex h-72 items-center justify-center rounded border">
          <Spinner size="lg" className="text-muted-foreground" />
        </div>
      ) : (
        <AttendanceCalendar days={days} />
      )}
    </div>
  )
}
