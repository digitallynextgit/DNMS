"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Pencil, Users, UserCheck, UserX, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { DateField } from "@/components/shared/date-field"
import { EmptyState } from "@/components/shared/empty-state"
import { ListSkeleton } from "@/components/shared/loading-skeleton"
import { ManualAttendanceDialog } from "@/features/attendance"
import { useAttendanceDirectory, type AttendanceDirectoryRow } from "@/features/attendance"
import { usePermissions } from "@/features/admin"
import { PERMISSIONS } from "@/lib/constants"
import { cn, formatWorkHours } from "@/lib/utils"
import { format } from "date-fns"

const STATUS_META: Record<string, { label: string; cls: string }> = {
  PRESENT: {
    label: "Present",
    cls: "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300",
  },
  HALF_DAY: {
    label: "Half day",
    cls: "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300",
  },
  MISSING_PUNCH: {
    label: "Missing punch",
    cls: "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300",
  },
  ABSENT: { label: "On Leave", cls: "bg-muted text-muted-foreground" },
}

function fmtTime(iso: string | null): string {
  if (!iso) return "-"
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
}

export default function AttendanceDirectoryPage() {
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
      <div className="flex items-center gap-2.5">
        <AvatarDisplay
          src={r.profilePhoto}
          firstName={r.firstName}
          lastName={r.lastName}
          size="sm"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {r.firstName} {r.lastName}
          </p>
          <p className="text-muted-foreground truncate text-xs">
            {r.employeeNo}
            {r.department ? ` · ${r.department}` : ""}
          </p>
        </div>
      </div>
    ),
  }

  const statusCol: DataTableColumn<AttendanceDirectoryRow> = {
    header: "Status",
    cell: (r) => {
      const m = STATUS_META[r.status] ?? STATUS_META.ABSENT
      return (
        <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", m.cls)}>
          {m.label}
        </span>
      )
    },
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
          value={isLoading ? "-" : (summary?.totalEmployees ?? 0)}
          icon={Users}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
        />
        <StatCard
          title="Present"
          value={isLoading ? "-" : (summary?.present ?? 0)}
          icon={UserCheck}
          iconColor="text-green-600"
          iconBg="bg-green-50"
        />
        <StatCard
          title="On Leave"
          value={isLoading ? "-" : (summary?.notPresent ?? 0)}
          icon={UserX}
          iconColor="text-red-600"
          iconBg="bg-red-50"
        />
        <StatCard
          title="Half Day"
          value={isLoading ? "-" : (summary?.halfDay ?? 0)}
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

      {/* Roster - one row per employee, no per-row actions */}
      {isLoading ? (
        <ListSkeleton rows={6} height="h-14" />
      ) : rows.length === 0 ? (
        <EmptyState variant="card" title="No employees found." />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.employeeId}
          showSerial
          minWidth="min-w-[720px]"
        />
      )}

      {/* HR correction */}
      <ManualAttendanceDialog open={correctOpen} onOpenChange={setCorrectOpen} />
    </div>
  )
}
