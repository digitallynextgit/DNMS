"use client"

import { useState } from "react"
import { PageHeader } from "@/components/shared/page-header"
import { LeaveTypeForm } from "@/features/leave"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { ListSkeleton } from "@/components/shared/loading-skeleton"
import { useLeaveTypes, useDeleteLeaveType, useUpdateLeaveType } from "@/features/leave"
import type { LeaveType } from "@/features/leave"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { usePermissions } from "@/features/admin"
import { PERMISSIONS } from "@/lib/constants"
import { Plus, MoreHorizontal, Pencil, ToggleLeft, ToggleRight, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Pagination } from "@/components/shared/pagination"

const PAGE_SIZE = 10

export default function LeaveTypesPage() {
  const { can } = usePermissions()
  const canManage = can(PERMISSIONS.LEAVE_APPROVE)

  const { data, isLoading } = useLeaveTypes()
  const deleteLeaveType = useDeleteLeaveType()
  const updateLeaveType = useUpdateLeaveType()

  const [formOpen, setFormOpen] = useState(false)
  const [editingType, setEditingType] = useState<LeaveType | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  // useLeaveTypes only returns active types; we need all for admin
  // We'll show based on what the API returns
  const leaveTypes = data?.data ?? []

  // Client-side pagination (getLeaveTypes is reused as a dropdown/lookup elsewhere,
  // so we fetch the full list and paginate locally).
  const total = leaveTypes.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pagedTypes = leaveTypes.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  function openCreate() {
    setEditingType(null)
    setFormOpen(true)
  }

  function openEdit(type: LeaveType) {
    setEditingType(type)
    setFormOpen(true)
  }

  async function handleToggleActive(type: LeaveType) {
    await updateLeaveType.mutateAsync({
      id: type.id,
      body: { isActive: !type.isActive },
    })
  }

  async function handleDelete() {
    if (!deleteId) return
    await deleteLeaveType.mutateAsync(deleteId)
    setDeleteId(null)
  }

  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-muted-foreground text-sm">
          You do not have permission to manage leave types.
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="flex cursor-pointer items-center gap-2"
              onClick={() => openEdit(type)}
            >
              <Pencil className="h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              className="flex cursor-pointer items-center gap-2"
              onClick={() => handleToggleActive(type)}
            >
              {type.isActive ? (
                <>
                  <ToggleLeft className="h-4 w-4" />
                  Deactivate
                </>
              ) : (
                <>
                  <ToggleRight className="h-4 w-4" />
                  Activate
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive flex cursor-pointer items-center gap-2"
              onClick={() => setDeleteId(type.id)}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave Types"
        description="Manage leave types available to employees."
        actions={
          <Button onClick={openCreate} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New Leave Type
          </Button>
        }
      />

      {/* Table */}
      {isLoading ? (
        <ListSkeleton rows={5} height="h-14" />
      ) : leaveTypes.length === 0 ? (
        <EmptyState
          variant="card"
          title="No leave types configured yet."
          action={{ label: "Create First Leave Type", onClick: openCreate }}
        />
      ) : (
        <DataTable columns={columns} rows={pagedTypes} rowKey={(type) => type.id} />
      )}

      {!isLoading && total > 0 && (
        <Pagination
          page={currentPage}
          totalPages={totalPages}
          total={total}
          onPageChange={setPage}
          itemLabel="leave type"
        />
      )}

      <LeaveTypeForm open={formOpen} onOpenChange={setFormOpen} leaveType={editingType} />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Deactivate Leave Type"
        description="This will deactivate the leave type and hide it from employees. Existing leave requests and balances will not be affected."
        confirmLabel="Deactivate"
        variant="destructive"
        onConfirm={handleDelete}
        isLoading={deleteLeaveType.isPending}
      />
    </div>
  )
}
