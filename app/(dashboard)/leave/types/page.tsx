"use client"

import { useState } from "react"
import { useUrlPage, useUrlState } from "@/hooks/use-url-state"
import { PageHeader } from "@/components/shared/page-header"
import {
  LeaveTypeForm,
  LeavePolicyMatrix,
  LeavePolicyActions,
  useLeavePolicyEditor,
} from "@/features/leave"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { DeleteDialog } from "@/components/shared/delete-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { useLeaveTypes, useDeleteLeaveType, useUpdateLeaveType } from "@/features/leave"
import type { LeaveType } from "@/features/leave"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { usePermissions } from "@/features/admin"
import { PERMISSIONS, SYSTEM_ROLES } from "@/lib/constants"
import { Plus, Pencil, ToggleLeft, ToggleRight, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useRowSelection } from "@/hooks/use-row-selection"
import { BulkActionBar } from "@/components/shared/bulk-action-bar"

const PAGE_SIZE = 10

export default function LeaveTypesAndPolicyPage() {
  const { can, roles, isAdmin_ } = usePermissions()
  // Types: any leave manager. Policy (company-wide allocations): HR Manager / Admin.
  const canManageTypes = can(PERMISSIONS.LEAVE_APPROVE)
  const canManagePolicy =
    isAdmin_ || roles.includes(SYSTEM_ROLES.HR_MANAGER) || roles.includes(SYSTEM_ROLES.ADMIN)

  const [tab, setTab] = useUrlState("tab", canManageTypes ? "types" : "policy")

  // Shared policy-grid editing state, so its Save / Re-sync buttons can live in
  // the page header next to the tabs.
  const policyEditor = useLeavePolicyEditor(canManagePolicy)

  const { data, isLoading } = useLeaveTypes()
  const deleteLeaveType = useDeleteLeaveType()
  const updateLeaveType = useUpdateLeaveType()

  const [formOpen, setFormOpen] = useState(false)
  const [editingType, setEditingType] = useState<LeaveType | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [page, setPage] = useUrlPage()

  // useLeaveTypes returns the full list; paginate locally (it's reused as a
  // dropdown/lookup elsewhere so the API stays unpaginated).
  const leaveTypes = data?.data ?? []
  const total = leaveTypes.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pagedTypes = leaveTypes.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const selection = useRowSelection(pagedTypes.map((t) => t.id))
  const [bulkOpen, setBulkOpen] = useState(false)

  function openCreate() {
    setEditingType(null)
    setFormOpen(true)
  }

  function openEdit(type: LeaveType) {
    setEditingType(type)
    setFormOpen(true)
  }

  async function handleToggleActive(type: LeaveType) {
    await updateLeaveType.mutateAsync({ id: type.id, body: { isActive: !type.isActive } })
  }

  async function handleDelete(permanent: boolean) {
    if (!deleteId) return
    await deleteLeaveType.mutateAsync({ id: deleteId, permanent })
    setDeleteId(null)
  }

  async function handleBulkDeactivate() {
    for (const id of selection.selectedIds) {
      await deleteLeaveType.mutateAsync({ id })
    }
    selection.clear()
    setBulkOpen(false)
  }

  if (!canManageTypes && !canManagePolicy) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-muted-foreground text-sm">
          You do not have permission to manage leave types or policy.
        </p>
      </div>
    )
  }

  const columns: DataTableColumn<LeaveType>[] = [
    {
      header: "Name",
      cell: (type) => (
        <>
          <p className="font-medium">{type.name}</p>
          {type.description && (
            <p className="text-muted-foreground max-w-[200px] truncate text-xs">
              {type.description}
            </p>
          )}
        </>
      ),
    },
    {
      header: "Code",
      cell: (type) => (
        <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">{type.code}</code>
      ),
    },
    {
      header: "Type",
      cell: (type) => (
        <Badge
          className={cn(
            "border-0 text-xs",
            type.isPaid ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700",
          )}
        >
          {type.isPaid ? "Paid" : "Unpaid"}
        </Badge>
      ),
    },
    {
      header: "Max Days / Year",
      className: "text-muted-foreground",
      cell: (type) => (type.maxDaysPerYear === 0 ? "Unlimited" : `${type.maxDaysPerYear} days`),
    },
    {
      header: "Carry Forward",
      className: "text-muted-foreground",
      cell: (type) =>
        type.carryForward ? (
          <span>
            Yes
            {type.maxCarryDays > 0 && (
              <span className="ml-1 text-xs">(max {type.maxCarryDays}d)</span>
            )}
          </span>
        ) : (
          "No"
        ),
    },
    {
      header: "Approval",
      className: "text-muted-foreground",
      cell: (type) => (type.requiresApproval ? "Required" : "Auto-approved"),
    },
    {
      header: "Status",
      cell: (type) => (
        <Badge
          className={cn(
            "border-0 text-xs",
            type.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700",
          )}
        >
          {type.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      header: "Actions",
      align: "right",
      cell: (type) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => openEdit(type)} title="Edit">
            <Pencil className="h-4 w-4" />
            <span className="sr-only">Edit</span>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => handleToggleActive(type)}
            title={type.isActive ? "Deactivate" : "Activate"}
          >
            {type.isActive ? (
              <ToggleLeft className="h-4 w-4" />
            ) : (
              <ToggleRight className="h-4 w-4" />
            )}
            <span className="sr-only">{type.isActive ? "Deactivate" : "Activate"}</span>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteId(type.id)}
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Delete</span>
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <PageHeader
          title="Leave Types & Policy"
          description="Configure leave types and set how many days each employment type gets per year."
          actions={
            <div className="flex items-center gap-2">
              <TabsList>
                {canManageTypes && <TabsTrigger value="types">Types</TabsTrigger>}
                {canManagePolicy && <TabsTrigger value="policy">Policy</TabsTrigger>}
              </TabsList>
              {tab === "types" && canManageTypes && (
                <Button onClick={openCreate} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  New Leave Type
                </Button>
              )}
              {tab === "policy" && canManagePolicy && <LeavePolicyActions editor={policyEditor} />}
            </div>
          }
        />

        {canManageTypes && (
          <TabsContent value="types" className="space-y-6">
            <BulkActionBar count={selection.count} onClear={selection.clear}>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setBulkOpen(true)}
                disabled={deleteLeaveType.isPending}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Deactivate
              </Button>
            </BulkActionBar>

            {/* The table renders from the first paint: while `isLoading` it draws
                skeleton rows inside its own real <thead>, so the header, column
                count and S.No column never move when the data lands. */}
            {isLoading || leaveTypes.length > 0 ? (
              <DataTable
                columns={columns}
                rows={pagedTypes}
                rowKey={(type) => type.id}
                showSerial
                serialOffset={(currentPage - 1) * PAGE_SIZE}
                selection={selection}
                loading={isLoading}
                skeletonRows={PAGE_SIZE}
                pagination={{
                  page: currentPage,
                  totalPages,
                  total,
                  onPageChange: setPage,
                  itemLabel: "leave type",
                }}
              />
            ) : (
              <EmptyState
                variant="card"
                title="No leave types configured yet."
                action={{ label: "Create First Leave Type", onClick: openCreate }}
              />
            )}
          </TabsContent>
        )}

        {canManagePolicy && (
          <TabsContent value="policy">
            <LeavePolicyMatrix editor={policyEditor} />
          </TabsContent>
        )}
      </Tabs>

      <LeaveTypeForm open={formOpen} onOpenChange={setFormOpen} leaveType={editingType} />

      <DeleteDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete leave type"
        description="Deactivating hides it from employees but keeps its data (recoverable). Permanent delete removes the type and its balances, policy rows and requests for good."
        canPermanent={canManagePolicy}
        onConfirm={handleDelete}
        isLoading={deleteLeaveType.isPending}
      />

      <ConfirmDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        title={`Deactivate ${selection.count} leave type${selection.count === 1 ? "" : "s"}?`}
        description="The selected leave types will be deactivated and hidden from employees. Existing requests and balances are unaffected."
        confirmLabel="Deactivate"
        variant="destructive"
        onConfirm={handleBulkDeactivate}
        isLoading={deleteLeaveType.isPending}
      />
    </div>
  )
}
