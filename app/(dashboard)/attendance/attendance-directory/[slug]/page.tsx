"use client"

import { useEffect, useState } from "react"
import { Spinner } from "@/components/shared/spinner"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { CheckCircle2, AlertTriangle, Clock, Timer, ChevronLeft } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { StatCard } from "@/components/shared/stat-card"
import { MonthNav, MONTH_NAMES } from "@/components/shared/month-nav"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { Button } from "@/components/ui/button"
import { useEmployee } from "@/features/employees"
import { useEmployeeAttendanceCalendar } from "@/features/attendance"
import { AttendanceCalendar } from "@/features/attendance/components/attendance-calendar"
import { usePermissions } from "@/features/admin"
import { PERMISSIONS } from "@/lib/constants"
import { formatWorkHours } from "@/lib/utils"

export default function EmployeeAttendancePage() {
  const params = useParams()
  const slug = params.slug as string
  const router = useRouter()
  const { status: sessionStatus } = useSession()
  const { can } = usePermissions()
  const canWrite = can(PERMISSIONS.ATTENDANCE_WRITE)

  // HR/admin-only, like the directory it's opened from.
  useEffect(() => {
    if (sessionStatus === "authenticated" && !canWrite) router.replace("/attendance/me")
  }, [sessionStatus, canWrite, router])

  const now = new Date()
  const curY = now.getFullYear()
  const curM = now.getMonth() + 1
  const [year, setYear] = useState(curY)
  const [month, setMonth] = useState(curM)

  const { data: empData, isLoading: empLoading } = useEmployee(slug)
  const employee = empData?.data
  const { data, isLoading } = useEmployeeAttendanceCalendar(employee?.id, year, month)

  const days = data?.data.days ?? []
  const firstPunch = data?.data.firstPunchDate ?? null
  const firstY = firstPunch ? Number(firstPunch.slice(0, 4)) : null
  const firstM = firstPunch ? Number(firstPunch.slice(5, 7)) : null

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

  const presentDays = days.filter((d) => d.status === "PRESENT").length
  const missingPunchDays = days.filter((d) => d.status === "MISSING_PUNCH").length
  const halfDays = days.filter((d) => d.status === "HALF_DAY").length
  const worked = days.filter((d) => d.workHours != null && d.workHours > 0)
  const totalHours = worked.reduce((sum, d) => sum + (d.workHours ?? 0), 0)
  const avgHours = worked.length > 0 ? totalHours / worked.length : 0

  if (sessionStatus === "authenticated" && !canWrite) return null

  if (!empLoading && !employee) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground text-sm">Employee not found.</p>
        <Button variant="outline" asChild className="mt-4">
          <Link href="/attendance/attendance-directory">
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back to directory
          </Link>
        </Button>
      </div>
    )
  }

  const fullName = employee ? `${employee.firstName} ${employee.lastName}` : ""

  return (
    <div className="space-y-6">
      {/* One PageHeader: the back button, the avatar and the identity line all live in
          it, so this page's Back button is the SAME control (outline, size sm, hover
          chevron) as every other detail page instead of a one-off ghost link. */}
      <PageHeader
        backHref="/attendance/attendance-directory"
        backLabel="Back to directory"
        leading={
          employee ? (
            <AvatarDisplay
              src={employee.profilePhoto}
              firstName={employee.firstName}
              lastName={employee.lastName}
              size="md"
            />
          ) : (
            <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          )
        }
        title={employee ? fullName : <Skeleton className="h-6 w-40" />}
        description={
          employee ? (
            `${employee.employeeNo}${employee.designation?.title ? ` · ${employee.designation.title}` : ""}`
          ) : (
            <Skeleton className="h-4 w-32" />
          )
        }
        actions={
          <MonthNav
            year={year}
            month={month - 1}
            onPrev={prev}
            onNext={next}
            canPrev={canPrev && !isLoading}
            canNext={canNext && !isLoading}
          />
        }
      />

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

      {isLoading || empLoading ? (
        <div className="bg-card flex h-72 items-center justify-center rounded border">
          <Spinner size="lg" className="text-muted-foreground" />
        </div>
      ) : (
        <AttendanceCalendar days={days} />
      )}
    </div>
  )
}
