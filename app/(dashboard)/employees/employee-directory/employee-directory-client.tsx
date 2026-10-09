"use client"

import { useState, useCallback, useMemo, useEffect } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Link } from "@/components/tenant-link"
import { Plus, Eye, Trash2, UserCheck, UserX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/page-header"
import { Pagination } from "@/components/shared/pagination"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyState } from "@/components/shared/empty-state"
import { CardGridSkeleton } from "@/components/shared/loading-skeleton"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { ViewToggle, type ViewMode } from "@/components/shared/view-toggle"
import { useRowSelection } from "@/hooks/use-row-selection"
import { useUpdateEffect } from "@/hooks/use-update-effect"
import {
  EmployeeCard,
  EmployeeCellSkeleton,
  EmployeeStatusSkeleton,
  EmployeeActionsSkeleton,
} from "@/features/employees"
import { EmployeeFilters } from "@/features/employees"
import { apiFetch } from "@/lib/api-fetch"
import {
  useEmployees,
  useDeleteEmployee,
  useActivateEmployee,
  useHardDeleteEmployee,
  type EmployeeListItem,
} from "@/features/employees"
import { usePermissions } from "@/features/admin/hooks/use-permissions"
import { useDebounce } from "@/hooks/use-debounce"
import { formatDate, employeeSlug } from "@/lib/utils"
import { isOnProbation } from "@/features/employees"
import {
  ACTIVE_STATUS_COLORS,
  ACTIVE_STATUS_LABELS,
  PERMISSIONS,
  PROBATION_BADGE,
} from "@/lib/constants"

export function EmployeeDirectoryClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const { can } = usePermissions()

  const [hardDeleteId, setHardDeleteId] = useState<string | null>(null)
  const deactivateEmployee = useDeleteEmployee()
  const activateEmployee = useActivateEmployee()
  const hardDeleteEmployee = useHardDeleteEmployee()

  const queryClient = useQueryClient()
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)

  // The URL is the single source of truth for filters, page and view; setParams is the only writer.
  const departmentId = searchParams.get("departmentId") ?? ""
  // Active by default. "All Statuses" is an explicit ?status=all - empty would fall back to Active.
  const statusParam = searchParams.get("status") ?? "ACTIVE"
  const status = statusParam === "all" ? "" : statusParam
  // Card view is ?view=card, not localStorage, so a remembered "card" can't stick for good.
  const viewMode: ViewMode = searchParams.get("view") === "card" ? "card" : "table"
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"))

  // Local state for responsive typing; the debounced value goes to the URL.
  const [search, setSearch] = useState(searchParams.get("search") ?? "")
  const debouncedSearch = useDebounce(search, 350)

  const setParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(updates)) {
        // Drop default values so a pristine view keeps a clean URL.
        const isDefault =
          value === "" ||
          (key === "status" && value === "ACTIVE") ||
          (key === "view" && value === "table") ||
          (key === "page" && value === "1")
        if (isDefault) params.delete(key)
        else params.set(key, value)
      }
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [searchParams, router, pathname],
  )

  const setPage = useCallback((p: number) => setParams({ page: String(p) }), [setParams])
  const setViewMode = (v: ViewMode) => setParams({ view: v })

  // Skips the initial mount so a deep-linked ?page=N isn't wiped on first render.
  useUpdateEffect(() => {
    setParams({ search: debouncedSearch, page: "1" })
  }, [debouncedSearch])

  function handleDepartmentChange(v: string) {
    setParams({ departmentId: v, page: "1" })
  }

  function handleStatusChange(v: string) {
    setParams({ status: v || "all", page: "1" })
  }

  function handleClearFilters() {
    setSearch("")
    router.replace(viewMode === "card" ? `${pathname}?view=card` : pathname, { scroll: false })
  }

  const { data, isLoading } = useEmployees({
    search: debouncedSearch,
    departmentId: departmentId || undefined,
    status: status || undefined,
    page,
    limit: 10,
  })

  const employees = data?.data ?? []
  const pagination = data?.pagination

  async function confirmHardDelete() {
    if (!hardDeleteId) return
    try {
      await hardDeleteEmployee.mutateAsync(hardDeleteId)
      setHardDeleteId(null)
    } catch {
      // the mutation hook already toasts the error; just keep the form open
    }
  }

  const pageIds = useMemo(() => employees.map((e) => e.id), [employees])
  const selection = useRowSelection<string>(pageIds)
  const { selectedIds, count, clear } = selection

  useEffect(() => {
    clear()
  }, [debouncedSearch, departmentId, status, page, clear])

  async function confirmBulkDelete() {
    if (count === 0) return
    setBulkBusy(true)
    try {
      const body = await apiFetch<{ data: { data: { count: number } } }>(
        "/api/employees/bulk-terminate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: selectedIds }),
        },
      )
      toast.success(`Terminated ${body.data.data.count ?? count} employees`)
      queryClient.invalidateQueries({ queryKey: ["employees"] })
      clear()
      setBulkDeleteOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bulk terminate failed")
    } finally {
      setBulkBusy(false)
    }
  }

  const columns: DataTableColumn<EmployeeListItem>[] = [
    {
      header: "Employee",
      skeleton: <EmployeeCellSkeleton />,
      exportValue: (emp) => `${emp.firstName} ${emp.lastName}`,
      cell: (emp) => (
        <Link
          href={`/employees/${employeeSlug(emp.employeeNo, emp.firstName, emp.lastName)}`}
          className="group flex items-center gap-3"
        >
          <AvatarDisplay
            src={emp.profilePhoto}
            firstName={emp.firstName}
            lastName={emp.lastName}
            size="sm"
            className="shrink-0"
          />
          <div className="min-w-0">
            <p className="truncate font-medium underline-offset-4 group-hover:underline">
              {emp.firstName} {emp.lastName}
            </p>
            <p className="text-muted-foreground text-xs">{emp.employeeNo}</p>
          </div>
        </Link>
      ),
    },
    {
      header: "Employee No",
      defaultHidden: true,
      className: "text-muted-foreground font-mono text-xs",
      exportValue: (emp) => emp.employeeNo,
      cell: (emp) => emp.employeeNo,
    },
    {
      header: "Email",
      defaultHidden: true,
      className: "text-muted-foreground max-w-[280px] truncate",
      exportValue: (emp) => emp.email,
      cell: (emp) => <span title={emp.email}>{emp.email}</span>,
    },
    {
      header: "Department",
      className: "text-muted-foreground",
      exportValue: (emp) => emp.department?.name ?? "",
      cell: (emp) => emp.department?.name ?? "-",
    },
    {
      header: "Designation",
      className: "text-muted-foreground",
      exportValue: (emp) => emp.designation?.title ?? "",
      cell: (emp) => emp.designation?.title ?? "-",
    },
    {
      header: "Status",
      skeleton: <EmployeeStatusSkeleton />,
      exportValue: (emp) => ACTIVE_STATUS_LABELS[emp.isActive ? "ACTIVE" : "INACTIVE"],
      cell: (emp) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge
            status={emp.isActive ? "ACTIVE" : "INACTIVE"}
            colorMap={ACTIVE_STATUS_COLORS}
            labelMap={ACTIVE_STATUS_LABELS}
          />
          {isOnProbation(emp) && (
            <StatusBadge
              status="Probation"
              label="Probation"
              colorMap={{ Probation: PROBATION_BADGE }}
            />
          )}
        </div>
      ),
    },
    {
      header: "Joined",
      className: "text-muted-foreground",
      exportValue: (emp) => (emp.dateOfJoining ? formatDate(emp.dateOfJoining) : ""),
      cell: (emp) => formatDate(emp.dateOfJoining),
    },
    {
      header: "",
      align: "right",
      skeleton: <EmployeeActionsSkeleton />,
      cell: (emp) => {
        const fullName = `${emp.firstName} ${emp.lastName}`
        return (
          <div className="flex items-center justify-end gap-1">
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground"
              title="View"
            >
              <Link
                href={`/employees/${employeeSlug(emp.employeeNo, emp.firstName, emp.lastName)}`}
                aria-label={`View ${fullName}`}
              >
                <Eye className="h-4 w-4" />
              </Link>
            </Button>
            {emp.isActive ? (
              <>
                {can(PERMISSIONS.EMPLOYEE_DELETE) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
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
                    className="text-green-600 hover:bg-green-500/10 hover:text-green-600 dark:text-green-400 dark:hover:text-green-400"
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
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
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
        )
      },
    },
  ]

  // One filter set for both views: inside the table's frame, or above the cards.
  const filters = (
    <div className="min-w-0 flex-1">
      <EmployeeFilters
        search={search}
        onSearchChange={setSearch}
        departmentId={departmentId}
        onDepartmentChange={handleDepartmentChange}
        status={status}
        onStatusChange={handleStatusChange}
        onClear={handleClearFilters}
      />
    </div>
  )

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
          <div className="flex flex-wrap items-center gap-2">
            <ViewToggle value={viewMode} onChange={setViewMode} />
            {can(PERMISSIONS.EMPLOYEE_WRITE) && (
              <Button asChild>
                <Link href="/employees/new" className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add Employee
                </Link>
              </Button>
            )}
          </div>
        }
      />

      {viewMode === "card" && filters}

      {isLoading && viewMode === "card" && <CardGridSkeleton count={8} />}

      {/* "Add First Employee" only when there's genuinely no one - not for an empty search result. */}
      {!isLoading && employees.length === 0 && viewMode === "card" && (
        <EmptyState
          title={search ? "No employees match your search." : "No employees found."}
          action={
            !search && can(PERMISSIONS.EMPLOYEE_WRITE)
              ? { label: "Add First Employee", href: "/employees/new" }
              : undefined
          }
        />
      )}

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

      {viewMode === "table" && (
        <DataTable
          tableId="employees"
          exportName="employees"
          itemLabel="employee"
          columns={columns}
          rows={employees}
          rowKey={(emp) => emp.id}
          showSerial
          serialOffset={((pagination?.page ?? 1) - 1) * (pagination?.limit ?? 10)}
          selection={selection}
          selectionActions={
            can(PERMISSIONS.EMPLOYEE_DELETE) ? (
              <Button
                className="gap-1.5"
                variant="destructive"
                onClick={() => setBulkDeleteOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Terminate
              </Button>
            ) : undefined
          }
          toolbar={filters}
          empty={search ? "No employees match your search." : "No employees found."}
          loading={isLoading}
          skeletonRows={10}
          mobileCard={(emp) => (
            <Link
              href={`/employees/${employeeSlug(emp.employeeNo, emp.firstName, emp.lastName)}`}
              className="flex items-start gap-3"
            >
              <AvatarDisplay
                src={emp.profilePhoto}
                firstName={emp.firstName}
                lastName={emp.lastName}
                size="sm"
                className="shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {emp.firstName} {emp.lastName}
                </p>
                <p className="text-muted-foreground truncate text-xs">
                  {emp.designation?.title ?? "-"}
                  {emp.department?.name ? ` · ${emp.department.name}` : ""}
                </p>
                <p className="text-muted-foreground mt-0.5 truncate text-[11px]">
                  {emp.employeeNo}
                </p>
              </div>
              <StatusBadge
                status={emp.isActive ? "ACTIVE" : "INACTIVE"}
                colorMap={ACTIVE_STATUS_COLORS}
                labelMap={ACTIVE_STATUS_LABELS}
                size="xs"
              />
            </Link>
          )}
          pagination={
            pagination
              ? {
                  page: pagination.page,
                  totalPages: pagination.totalPages,
                  total: pagination.total,
                  onPageChange: setPage,
                  itemLabel: "employee",
                  pageSize: pagination.limit,
                }
              : undefined
          }
        />
      )}

      {/* The table view renders its own pagination. */}
      {pagination && viewMode === "card" && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          onPageChange={setPage}
          itemLabel="employee"
          pageSize={pagination.limit}
        />
      )}

      <ConfirmDialog
        open={!!hardDeleteId}
        onOpenChange={(open) => !open && setHardDeleteId(null)}
        title="Delete employee permanently?"
        description="This permanently removes the employee record and cannot be undone. Their attendance, leave, payroll and document history will be detached or removed."
        confirmLabel={hardDeleteEmployee.isPending ? "Deleting..." : "Delete permanently"}
        variant="destructive"
        onConfirm={confirmHardDelete}
        isLoading={hardDeleteEmployee.isPending}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={`Terminate ${count} employees?`}
        description="Each selected employee will be marked as terminated and deactivated. You can reverse this individually from their profile. Your own account, if selected, will be skipped."
        confirmLabel={bulkBusy ? "Terminating..." : "Terminate"}
        variant="destructive"
        onConfirm={confirmBulkDelete}
        isLoading={bulkBusy}
      />
    </div>
  )
}
