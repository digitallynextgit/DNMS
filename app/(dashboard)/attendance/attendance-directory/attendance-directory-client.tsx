"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Link, useTenantPath } from "@/components/tenant-link"
import { useSession } from "next-auth/react"
import { Pencil, Users, UserCheck, UserX, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { TableSearch } from "@/components/shared/table-search"
import { StatusBadge } from "@/components/shared/status-badge"
import { ATTENDANCE_STATUS_COLORS, ATTENDANCE_STATUS_LABELS } from "@/lib/constants"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { DateField } from "@/components/shared/date-field"
import { ManualAttendanceDialog } from "@/features/attendance"
import { useAttendanceDirectory, type AttendanceDirectoryRow } from "@/features/attendance"
import { usePermissions } from "@/features/admin/hooks/use-permissions"
import { PERMISSIONS } from "@/lib/constants"
import { formatWorkHours, employeeSlug } from "@/lib/utils"
import { format } from "date-fns"

function fmtTime(iso: string | null): string {
  if (!iso) return "-"
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
}

export function AttendanceDirectoryClient() {
  const { can } = usePermissions()
  const { status: sessionStatus } = useSession()
  const router = useRouter()
  const tp = useTenantPath()
  const canWrite = can(PERMISSIONS.ATTENDANCE_WRITE)

  // HR/admin-only; everyone else uses their own calendar.
  useEffect(() => {
    if (sessionStatus === "authenticated" && !canWrite) router.replace(tp("/attendance/me"))
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

  const employeeCols: DataTableColumn<AttendanceDirectoryRow>[] = [
    {
      header: "Employee",
      sortValue: (r) => `${r.firstName} ${r.lastName}`.trim(),
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
    },
    {
      header: "Employee No",
      defaultHidden: true,
      sortValue: (r) => r.employeeNo,
      className: "font-mono text-xs",
      cell: (r) => r.employeeNo,
    },
  ]

  const statusCol: DataTableColumn<AttendanceDirectoryRow> = {
    header: "Status",
    sortValue: (r) => ATTENDANCE_STATUS_LABELS[r.status] ?? r.status,
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
        ...employeeCols,
        {
          header: "Check In",
          className: "tabular-nums",
          sortValue: (r) => r.checkIn,
          exportValue: (r) => (r.checkIn ? fmtTime(r.checkIn) : null),
          cell: (r) => fmtTime(r.checkIn),
        },
        {
          header: "Check Out",
          className: "tabular-nums",
          sortValue: (r) => r.checkOut,
          exportValue: (r) => (r.checkOut ? fmtTime(r.checkOut) : null),
          cell: (r) => fmtTime(r.checkOut),
        },
        {
          header: "Work Hours",
          className: "tabular-nums",
          sortValue: (r) => r.workHours,
          cell: (r) => (r.workHours != null ? formatWorkHours(r.workHours) : "-"),
        },
        statusCol,
      ]
    : [
        ...employeeCols,
        {
          header: "Present",
          align: "right",
          className: "tabular-nums",
          sortValue: (r) => r.presentDays,
          cell: (r) => r.presentDays,
        },
        {
          header: "Half Day",
          align: "right",
          className: "tabular-nums",
          sortValue: (r) => r.halfDays,
          cell: (r) => r.halfDays,
        },
        {
          header: "Absent",
          align: "right",
          className: "tabular-nums",
          sortValue: (r) => r.absentDays,
          cell: (r) => r.absentDays,
        },
        {
          header: "Avg Hours",
          align: "right",
          className: "tabular-nums",
          sortValue: (r) => r.avgHours,
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
            <Button className="gap-2" onClick={() => setCorrectOpen(true)}>
              <Pencil className="h-4 w-4" />
              Correct Punch
            </Button>
          ) : undefined
        }
      />

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
          // "Not Present": everyone without a punch (leave, absence or an unsynced device), not "On Leave".
          title="Not Present"
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

      {/* The dates also drive the cards above, so they stay out of the table's toolbar. */}
      <div className="flex flex-wrap items-end gap-3">
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

      <DataTable
        tableId="attendance-directory"
        exportName={from === to ? `attendance-${from}` : `attendance-${from}-to-${to}`}
        itemLabel="employee"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.employeeId}
        showSerial
        minWidth="min-w-[720px]"
        loading={isLoading}
        pageKey={`${from}|${to}|${q}`}
        toolbar={
          <TableSearch
            value={search}
            onChange={setSearch}
            placeholder="Search by name or ID..."
            label="Search employees by name or ID"
          />
        }
        empty={q ? "No employee matches that search." : "No employees found."}
      />

      <ManualAttendanceDialog open={correctOpen} onOpenChange={setCorrectOpen} />
    </div>
  )
}
