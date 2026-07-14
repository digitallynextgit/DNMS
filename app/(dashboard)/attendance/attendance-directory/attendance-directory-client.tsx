"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { Pencil, Users, UserCheck, UserX, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { StatusBadge } from "@/components/shared/status-badge"
import { ATTENDANCE_STATUS_COLORS, ATTENDANCE_STATUS_LABELS } from "@/lib/constants"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { DateField } from "@/components/shared/date-field"
import { EmptyState } from "@/components/shared/empty-state"
import { ManualAttendanceDialog } from "@/features/attendance"
import { useAttendanceDirectory, type AttendanceDirectoryRow } from "@/features/attendance"
import { usePermissions } from "@/features/admin"
import { PERMISSIONS } from "@/lib/constants"
import { cn, formatWorkHours, employeeSlug } from "@/lib/utils"
import { format } from "date-fns"

function fmtTime(iso: string | null): string {
  if (!iso) return "-"
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
}

export function AttendanceDirectoryClient() {
  const { can } = usePermissions()
  const { status: sessionStatus } = useSession()
  const router = useRouter()
  const canWrite = can(PERMISSIONS.ATTENDANCE_WRITE)

  // HR/admin-only; everyone else uses their own calendar.
  useEffect(() => {
    if (sessionStatus === "authenticated" && !canWrite) router.replace("/attendance/me")
  }, [sessionStatus, canWrite, router])

  const today = format(new Date(), "yyyy-MM-dd")
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [search, setSearch] = useState("")
  const [correctOpen, setCorrectOpen] = useState(false)

  const { data, isLoading } = useAttendanceDirectory(from, to)
  const isSingleDay = data?.isSingleDay ?? from === to
  const summary = data?.summary
  const allRows = data?.rows ?? []
  const q = search.trim().toLowerCase()
  const rows = q
    ? allRows.filter((r) =>
        `${r.firstName} ${r.lastName} ${r.employeeNo}`.toLowerCase().includes(q),
      )
    : allRows

  function changeFrom(v: string) {
    setFrom(v)
    if (v && to && v > to) setTo(v)
  }
  function changeTo(v: string) {
    setTo(v)
    if (v && from && v < from) setFrom(v)
  }
  function clearFilters() {
    setFrom(today)
    setTo(today)
    setSearch("")
  }

  if (sessionStatus === "authenticated" && !canWrite) return null

  const employeeCol: DataTableColumn<AttendanceDirectoryRow> = {
    header: "Employee",
    cell: (r) => (
      <Link
        href={`/attendance/attendance-directory/${employeeSlug(r.employeeNo, r.firstName, r.lastName)}`}
        className="group flex items-center gap-2.5"
      >
        <AvatarDisplay
          src={r.profilePhoto}
          firstName={r.firstName}
          lastName={r.lastName}
          size="sm"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium underline-offset-4 group-hover:underline">
            {r.firstName} {r.lastName}
          </p>
          <p className="text-muted-foreground truncate text-xs">
            {r.employeeNo}
            {r.department ? ` · ${r.department}` : ""}
          </p>
        </div>
      </Link>
    ),
  }

  const statusCol: DataTableColumn<AttendanceDirectoryRow> = {
    header: "Status",
    cell: (r) => (
      <StatusBadge
        status={r.status}
        colorMap={ATTENDANCE_STATUS_COLORS}
        labelMap={ATTENDANCE_STATUS_LABELS}
      />
    ),
  }

  const columns: DataTableColumn<AttendanceDirectoryRow>[] = isSingleDay
    ? [
        employeeCol,
        { header: "Check In", className: "tabular-nums", cell: (r) => fmtTime(r.checkIn) },
        { header: "Check Out", className: "tabular-nums", cell: (r) => fmtTime(r.checkOut) },
        {
          header: "Work Hours",
          className: "tabular-nums",
          cell: (r) => (r.workHours != null ? formatWorkHours(r.workHours) : "-"),
        },
        statusCol,
      ]
    : [
        employeeCol,
        {
          header: "Present",
          align: "right",
          className: "tabular-nums",
          cell: (r) => r.presentDays,
        },
        { header: "Half Day", align: "right", className: "tabular-nums", cell: (r) => r.halfDays },
        { header: "Absent", align: "right", className: "tabular-nums", cell: (r) => r.absentDays },
        {
          header: "Avg Hours",
          align: "right",
          className: "tabular-nums",
          cell: (r) => (r.avgHours ? formatWorkHours(r.avgHours) : "-"),
        },
      ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance Directory"
        description="Who's in today - one row per employee. Correct punch in / out times here."
        actions={
          canWrite ? (
            <Button onClick={() => setCorrectOpen(true)} className="gap-2">
              <Pencil className="h-4 w-4" />
              Correct Punch
            </Button>
          ) : undefined
        }
      />

      {/* Summary (for the selected day / range) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Employees"
          value={summary?.totalEmployees ?? 0}
          loading={isLoading}
          icon={Users}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
        />
        <StatCard
          title="Present"
          value={summary?.present ?? 0}
          loading={isLoading}
          icon={UserCheck}
          iconColor="text-green-600"
          iconBg="bg-green-50"
        />
        <StatCard
          title="On Leave"
          value={summary?.notPresent ?? 0}
          loading={isLoading}
          icon={UserX}
          iconColor="text-red-600"
          iconBg="bg-red-50"
        />
        <StatCard
          title="Half Day"
          value={summary?.halfDay ?? 0}
          loading={isLoading}
          icon={Clock}
          iconColor="text-orange-600"
          iconBg="bg-orange-50"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1 space-y-1.5">
          <Label htmlFor="dir-search">Employee</Label>
          <Input
            id="dir-search"
            placeholder="Search by name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-44 space-y-1.5">
          <Label>From</Label>
          <DateField value={from} onChange={changeFrom} endMonth={new Date()} />
        </div>
        <div className="w-44 space-y-1.5">
          <Label>To</Label>
          <DateField value={to} onChange={changeTo} endMonth={new Date()} />
        </div>
        {(from !== today || to !== today || search) && (
          <Button variant="ghost" onClick={clearFilters}>
            Clear
          </Button>
        )}
      </div>

      {/* Roster - one row per employee, no per-row actions. Rendered while
          loading too: `isSingleDay` falls back to `from === to`, so the correct
          column set is known before the data arrives and the skeleton rows are
          drawn inside the real <thead>. */}
      {isLoading || rows.length > 0 ? (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.employeeId}
          showSerial
          minWidth="min-w-[720px]"
          loading={isLoading}
        />
      ) : (
        <EmptyState variant="card" title="No employees found." />
      )}

      {/* HR correction */}
      <ManualAttendanceDialog open={correctOpen} onOpenChange={setCorrectOpen} />
    </div>
  )
}
