"use client"

import { useState, useCallback, useMemo, useEffect } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import Link from "next/link"
import { LayoutGrid, List, Plus, Pencil, Trash2, Download, X, UserCheck, UserX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/page-header"
import { EmployeeCard } from "@/components/employees/employee-card"
import { EmployeeFilters } from "@/components/employees/employee-filters"
import { bulkTerminateEmployees } from "@/lib/actions/employees"
import {
  useEmployees,
  useDeleteEmployee,
  useActivateEmployee,
  useHardDeleteEmployee,
} from "@/hooks/use-employees"
import { usePermissions } from "@/hooks/use-permissions"
import { useDebounce } from "@/hooks/use-debounce"
import { cn, getInitials, getAvatarColor, formatDate } from "@/lib/utils"
import { isOnProbation } from "@/lib/probation"
import { EMPLOYEE_STATUS_LABELS, PERMISSIONS } from "@/lib/constants"

type ViewMode = "card" | "table"

export default function EmployeesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const { can } = usePermissions()

  // ── View mode ────────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>("card")

  // ── Row action state ──────────────────────────────────────────────────────
  const [hardDeleteId, setHardDeleteId] = useState<string | null>(null)
  const deactivateEmployee = useDeleteEmployee()
  const activateEmployee = useActivateEmployee()
  const hardDeleteEmployee = useHardDeleteEmployee()

  // ── Bulk-selection state ──────────────────────────────────────────────────
  const queryClient = useQueryClient()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)

  // ── URL-synced filters ────────────────────────────────────────────────────
  const [search, setSearchRaw] = useState(searchParams.get("search") ?? "")
  const [departmentId, setDepartmentId] = useState(searchParams.get("departmentId") ?? "")
  const [status, setStatus] = useState(searchParams.get("status") ?? "")
  const [page, setPage] = useState(Number(searchParams.get("page") ?? "1"))

  const debouncedSearch = useDebounce(search, 350)

  // Sync URL helper
  const pushFilters = useCallback(
    (overrides: Record<string, string>) => {
      const params = new URLSearchParams()
      const merged = {
        search: debouncedSearch,
        departmentId,
        status,
        page: String(page),
        ...overrides,
      }
      Object.entries(merged).forEach(([k, v]) => {
        if (v && v !== "1") params.set(k, v)
        else if (v === "1" && k === "page") {
          // skip page=1
        } else if (v) params.set(k, v)
      })
      router.replace(`${pathname}?${params.toString()}`)
    },
    [debouncedSearch, departmentId, status, page, router, pathname],
  )

  function handleSearchChange(v: string) {
    setSearchRaw(v)
    setPage(1)
  }

  function handleDepartmentChange(v: string) {
    setDepartmentId(v)
    setPage(1)
    pushFilters({ departmentId: v, page: "1" })
  }

  function handleStatusChange(v: string) {
    setStatus(v)
    setPage(1)
    pushFilters({ status: v, page: "1" })
  }

  function handleClearFilters() {
    setSearchRaw("")
    setDepartmentId("")
    setStatus("")
    setPage(1)
    router.replace(pathname)
  }

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data, isLoading } = useEmployees({
    search: debouncedSearch,
    departmentId: departmentId || undefined,
    status: status || undefined,
    page,
    limit: 20,
  })

  const employees = data?.data ?? []
  const pagination = data?.pagination

  // ── Row action handlers ───────────────────────────────────────────────────
  async function confirmHardDelete() {
    if (!hardDeleteId) return
    await hardDeleteEmployee.mutateAsync(hardDeleteId)
    setHardDeleteId(null)
  }

  // ── Selection helpers ─────────────────────────────────────────────────────
  const pageIds = useMemo(() => employees.map((e) => e.id), [employees])
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id))
  const someOnPageSelected = pageIds.some((id) => selectedIds.has(id)) && !allOnPageSelected

  // Reset selection when filters change (different page contents).
  useEffect(() => {
    setSelectedIds(new Set())
  }, [debouncedSearch, departmentId, status, page])

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAllOnPage() {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allOnPageSelected) pageIds.forEach((id) => next.delete(id))
      else pageIds.forEach((id) => next.add(id))
      return next
    })
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  // CSV export of the currently selected rows.
  function exportSelectedCsv() {
    const selected = employees.filter((e) => selectedIds.has(e.id))
    if (selected.length === 0) return
    const cols = ["Employee No", "Name", "Email", "Department", "Designation", "Status", "Joined"]
    const rows = selected.map((e) => [
      e.employeeNo,
      `${e.firstName} ${e.lastName}`,
      e.email,
      e.department?.name ?? "",
      e.designation?.title ?? "",
      EMPLOYEE_STATUS_LABELS[e.status] ?? e.status,
      e.dateOfJoining ? formatDate(e.dateOfJoining) : "",
    ])
    const csv = [cols, ...rows]
      .map((row) =>
        row
          .map((cell) => {
            const s = String(cell ?? "")
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
          })
          .join(","),
      )
      .join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `employees-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${selected.length} employee${selected.length !== 1 ? "s" : ""}`)
  }

  // Bulk terminate via the bulkTerminateEmployees server action.
  async function confirmBulkDelete() {
    if (selectedIds.size === 0) return
    setBulkBusy(true)
    try {
      const r = await bulkTerminateEmployees(Array.from(selectedIds))
      if (!r.ok) throw new Error(r.error)
      toast.success(`Terminated ${r.data.data.count ?? selectedIds.size} employees`)
      queryClient.invalidateQueries({ queryKey: ["employees"] })
      clearSelection()
      setBulkDeleteOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bulk terminate failed")
    } finally {
      setBulkBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employees"
        description={
          pagination
            ? `${pagination.total} employee${pagination.total !== 1 ? "s" : ""} total`
            : "Employee directory"
        }
        actions={
          can(PERMISSIONS.EMPLOYEE_WRITE) ? (
            <Button asChild>
              <Link href="/employees/new" className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Employee
              </Link>
            </Button>
          ) : undefined
        }
      />

      {/* Filters + view toggle */}
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <EmployeeFilters
            search={search}
            onSearchChange={handleSearchChange}
            departmentId={departmentId}
            onDepartmentChange={handleDepartmentChange}
            status={status}
            onStatusChange={handleStatusChange}
            onClear={handleClearFilters}
          />
        </div>

        {/* View toggle */}
        <div className="bg-background flex items-center rounded border">
          <button
            onClick={() => setViewMode("card")}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-l-md transition-colors",
              viewMode === "card"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            title="Card view"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-r-md transition-colors",
              viewMode === "table"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            title="Table view"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Loading state */}
      {isLoading &&
        (viewMode === "card" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded" />
            ))}
          </div>
        ))}

      {/* Empty state */}
      {!isLoading && employees.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-muted-foreground text-sm">No employees found.</p>
          {can(PERMISSIONS.EMPLOYEE_WRITE) && (
            <Button asChild className="mt-4">
              <Link href="/employees/new">Add First Employee</Link>
            </Button>
          )}
        </div>
      )}

      {/* Card View */}
      {!isLoading && employees.length > 0 && viewMode === "card" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {employees.map((emp) => (
            <EmployeeCard
              key={emp.id}
              employee={emp}
              canEdit={can(PERMISSIONS.EMPLOYEE_WRITE)}
              canDelete={can(PERMISSIONS.EMPLOYEE_DELETE)}
              onDelete={(id) => deactivateEmployee.mutate(id)}
            />
          ))}
        </div>
      )}

      {/* Bulk action bar - visible when at least one row is selected */}
      {viewMode === "table" && selectedIds.size > 0 && (
        <div className="bg-accent/50 border-border flex flex-wrap items-center justify-between gap-3 rounded border px-3 py-2">
          <div className="flex items-center gap-3 text-sm">
            <span className="font-medium">{selectedIds.size} selected</span>
            <Button variant="ghost" size="sm" onClick={clearSelection} className="h-7 gap-1">
              <X className="h-3.5 w-3.5" />
              Clear
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportSelectedCsv} className="gap-1.5">
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
            {can(PERMISSIONS.EMPLOYEE_DELETE) && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setBulkDeleteOpen(true)}
                className="gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Terminate
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Table View */}
      {!isLoading && employees.length > 0 && viewMode === "table" && (
        <div className="bg-card rounded border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b">
                <th className="w-10 px-3 py-3 text-left">
                  <Checkbox
                    checked={
                      allOnPageSelected ? true : someOnPageSelected ? "indeterminate" : false
                    }
                    onCheckedChange={toggleAllOnPage}
                    aria-label="Select all on this page"
                  />
                </th>
                <th className="text-muted-foreground w-12 px-2 py-3 text-left font-medium">
                  S.No.
                </th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Employee</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">
                  Department
                </th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">
                  Designation
                </th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Status</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Joined</th>
                <th className="text-muted-foreground px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {employees.map((emp, idx) => {
                const fullName = `${emp.firstName} ${emp.lastName}`
                const initials = getInitials(emp.firstName, emp.lastName)
                const avatarBg = getAvatarColor(fullName)
                const isActive = emp.isActive
                const sno = ((pagination?.page ?? 1) - 1) * (pagination?.limit ?? 20) + idx + 1
                const isSelected = selectedIds.has(emp.id)

                return (
                  <tr
                    key={emp.id}
                    className={cn(
                      "hover:bg-muted/20 transition-colors",
                      isSelected && "bg-accent/30",
                    )}
                  >
                    <td className="px-3 py-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleRow(emp.id)}
                        aria-label={`Select ${fullName}`}
                      />
                    </td>
                    <td className="text-muted-foreground px-2 py-3 text-xs tabular-nums">{sno}</td>
                    {/* Employee column */}
                    <td className="px-4 py-3">
                      <Link href={`/employees/${emp.id}`} className="group flex items-center gap-3">
                        <Avatar className="h-8 w-8 shrink-0">
                          {emp.profilePhoto ? (
                            <AvatarImage src={emp.profilePhoto} alt={fullName} />
                          ) : null}
                          <AvatarFallback
                            className={cn("text-xs font-semibold text-white", avatarBg)}
                          >
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate font-medium underline-offset-4 group-hover:underline">
                            {fullName}
                          </p>
                          <p className="text-muted-foreground text-xs">{emp.employeeNo}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      {emp.department?.name ?? "-"}
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      {emp.designation?.title ?? "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                            isActive
                              ? "bg-green-500/15 text-green-600 dark:text-green-400"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {isActive ? "Active" : "Inactive"}
                        </span>
                        {isOnProbation(emp) && (
                          <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                            Probation
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      {formatDate(emp.dateOfJoining)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isActive ? (
                          <>
                            {can(PERMISSIONS.EMPLOYEE_WRITE) && (
                              <Button
                                asChild
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-foreground h-8 w-8"
                                title="Edit"
                              >
                                <Link
                                  href={`/employees/${emp.id}/edit`}
                                  aria-label={`Edit ${fullName}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Link>
                              </Button>
                            )}
                            {can(PERMISSIONS.EMPLOYEE_DELETE) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-destructive h-8 w-8"
                                onClick={() => deactivateEmployee.mutate(emp.id)}
                                disabled={deactivateEmployee.isPending}
                                title="Deactivate"
                                aria-label={`Deactivate ${fullName}`}
                              >
                                <UserX className="h-4 w-4" />
                              </Button>
                            )}
                          </>
                        ) : (
                          <>
                            {can(PERMISSIONS.EMPLOYEE_WRITE) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-green-600 hover:bg-green-500/10 hover:text-green-600 dark:text-green-400 dark:hover:text-green-400"
                                onClick={() => activateEmployee.mutate(emp.id)}
                                disabled={activateEmployee.isPending}
                                title="Reactivate"
                                aria-label={`Reactivate ${fullName}`}
                              >
                                <UserCheck className="h-4 w-4" />
                              </Button>
                            )}
                            {can(PERMISSIONS.EMPLOYEE_DELETE) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8"
                                onClick={() => setHardDeleteId(emp.id)}
                                title="Delete permanently"
                                aria-label={`Delete ${fullName}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            Page {pagination.page} of {pagination.totalPages} &middot; {pagination.total} total
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

      {/* Hard-delete confirmation dialog */}
      <AlertDialog open={!!hardDeleteId} onOpenChange={(open) => !open && setHardDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete employee permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the employee record and cannot be undone. Their attendance,
              leave, payroll and document history will be detached or removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={hardDeleteEmployee.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmHardDelete}
              disabled={hardDeleteEmployee.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {hardDeleteEmployee.isPending ? "Deleting..." : "Delete permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk terminate confirmation dialog */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Terminate {selectedIds.size} employees?</AlertDialogTitle>
            <AlertDialogDescription>
              Each selected employee will be marked as terminated and deactivated. You can reverse
              this individually from their profile. Your own account, if selected, will be skipped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              disabled={bulkBusy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkBusy ? "Terminating..." : "Terminate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
