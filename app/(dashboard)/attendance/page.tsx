"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Plus, Users, UserX, Clock, Timer, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/page-header"
import { Pagination } from "@/components/shared/pagination"
import { StatCard } from "@/components/shared/stat-card"
import { AttendanceFilters } from "@/features/attendance"
import { AttendanceTable } from "@/features/attendance"
import { ManualAttendanceDialog } from "@/features/attendance"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { useAttendanceLogs, useDeleteAttendanceLog } from "@/features/attendance"
import type { AttendanceLog } from "@/features/attendance"
import { usePermissions } from "@/features/admin"
import { PERMISSIONS } from "@/lib/constants"
import { format, startOfMonth, endOfMonth } from "date-fns"

export default function AttendancePage() {
  const { can } = usePermissions()
  const { status: sessionStatus } = useSession()
  const router = useRouter()
  const canWrite = can(PERMISSIONS.ATTENDANCE_WRITE)

  // Overview (all employees) is HR/admin-only; send everyone else to their own view.
  useEffect(() => {
    if (sessionStatus === "authenticated" && !canWrite) {
      router.replace("/attendance/me")
    }
  }, [sessionStatus, canWrite, router])

  // ── Filters ───────────────────────────────────────────────────────────────
  const [employeeSearch, setEmployeeSearch] = useState("")
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"))
  const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"))
  const [status, setStatus] = useState("")
  const [page, setPage] = useState(1)

  // ── Dialog state ──────────────────────────────────────────────────────────
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editLog, setEditLog] = useState<AttendanceLog | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const deleteLog = useDeleteAttendanceLog()

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data, isLoading } = useAttendanceLogs({
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    status: status || undefined,
    page,
    limit: 10,
  })

  const logs = data?.data ?? []
  const pagination = data?.pagination

  // Derive summary from the current loaded page for display purposes
  const presentCount = logs.filter((l) => l.status === "PRESENT").length
  const absentCount = logs.filter((l) => l.status === "ABSENT").length
  const halfDayCount = logs.filter((l) => l.status === "HALF_DAY").length
  // Late-mark tracking disabled for now (do not delete):
  // const lateCount = logs.filter((l) => l.status === "LATE").length
  const totalHoursOnPage = logs.reduce((sum, l) => sum + (l.workHours ?? 0), 0)
  const avgHours =
    logs.filter((l) => l.workHours).length > 0
      ? Math.round((totalHoursOnPage / logs.filter((l) => l.workHours).length) * 10) / 10
      : 0

  function handleClearFilters() {
    setEmployeeSearch("")
    setDateFrom(format(startOfMonth(new Date()), "yyyy-MM-dd"))
    setDateTo(format(endOfMonth(new Date()), "yyyy-MM-dd"))
    setStatus("")
    setPage(1)
  }

  function handleEdit(log: AttendanceLog) {
    setEditLog(log)
  }

  async function handleConfirmDelete() {
    if (!deleteId) return
    await deleteLog.mutateAsync(deleteId)
    setDeleteId(null)
  }

  function handleExport() {
    const params = new URLSearchParams()
    if (dateFrom) params.set("dateFrom", dateFrom)
    if (dateTo) params.set("dateTo", dateTo)
    if (status) params.set("status", status)
    window.open(`/api/attendance/export?${params.toString()}`, "_blank")
  }

  if (sessionStatus === "authenticated" && !canWrite) {
    return null
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance"
        description="Monitor and manage employee attendance records"
        actions={
          canWrite ? (
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleExport} className="gap-2">
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
              <Button onClick={() => setAddDialogOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Manual Record
              </Button>
            </div>
          ) : undefined
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Present (this page)"
          value={presentCount}
          icon={Users}
          iconColor="text-green-600"
          iconBg="bg-green-50"
        />
        <StatCard
          title="Absent (this page)"
          value={absentCount}
          icon={UserX}
          iconColor="text-red-600"
          iconBg="bg-red-50"
        />
        <StatCard
          title="Half-Day (this page)"
          value={halfDayCount}
          icon={Clock}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
        />
        {/* Late-mark tracking disabled for now (do not delete):
        <StatCard
          title="Late (this page)"
          value={lateCount}
          icon={Clock}
          iconColor="text-orange-600"
          iconBg="bg-orange-50"
        /> */}
        <StatCard
          title="Avg Work Hours"
          value={`${avgHours}h`}
          icon={Timer}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
          description="Average across records with hours logged"
        />
      </div>

      {/* Filters */}
      <AttendanceFilters
        employeeSearch={employeeSearch}
        onEmployeeSearchChange={(v) => {
          setEmployeeSearch(v)
          setPage(1)
        }}
        dateFrom={dateFrom}
        onDateFromChange={(v) => {
          setDateFrom(v)
          setPage(1)
        }}
        dateTo={dateTo}
        onDateToChange={(v) => {
          setDateTo(v)
          setPage(1)
        }}
        status={status}
        onStatusChange={(v) => {
          setStatus(v)
          setPage(1)
        }}
        onClear={handleClearFilters}
      />

      {/* Table */}
      <AttendanceTable logs={logs} isLoading={isLoading} canEdit={canWrite} onEdit={handleEdit} />

      {/* Pagination */}
      {pagination && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          onPageChange={setPage}
          itemLabel="record"
        />
      )}

      {/* Add / Edit dialog */}
      <ManualAttendanceDialog
        open={addDialogOpen || !!editLog}
        onOpenChange={(open) => {
          if (!open) {
            setAddDialogOpen(false)
            setEditLog(null)
          }
        }}
        editLog={editLog}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete Attendance Record"
        description="This will permanently delete this manual attendance record. This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleConfirmDelete}
        isLoading={deleteLog.isPending}
      />
    </div>
  )
}
