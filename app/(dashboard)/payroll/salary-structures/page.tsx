"use client"

import { useState, useEffect, useMemo } from "react"
import { useUrlPage } from "@/hooks/use-url-state"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/page-header"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { EmptyState } from "@/components/shared/empty-state"
import { TableSkeleton } from "@/components/shared/loading-skeleton"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { SalaryStructureForm } from "@/features/payroll"
import {
  useSalaryStructures,
  useDeleteSalaryStructure,
  type SalaryStructure,
} from "@/features/payroll"
import { usePermissions } from "@/features/admin"
import { PERMISSIONS } from "@/lib/constants"

function fmt(amount: number): string {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function grossOf(structure: SalaryStructure): number {
  return (
    structure.basicSalary +
    structure.hra +
    structure.conveyance +
    structure.medicalAllowance +
    structure.telephoneAllowance +
    structure.otherAllowances
  )
}

export default function SalaryStructuresPage() {
  const { can } = usePermissions()
  const router = useRouter()
  const { status: sessionStatus } = useSession()
  const canWrite = can(PERMISSIONS.PAYROLL_WRITE)

  // HR-only page; employees use My Payslips.
  useEffect(() => {
    if (sessionStatus === "authenticated" && !canWrite) {
      router.replace("/payroll/me")
    }
  }, [sessionStatus, canWrite, router])

  const [formOpen, setFormOpen] = useState(false)
  const [editData, setEditData] = useState<SalaryStructure | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [page, setPage] = useUrlPage()

  const { data, isLoading } = useSalaryStructures()
  const deleteMutation = useDeleteSalaryStructure()

  const structures = data?.data ?? []

  // Client-side pagination (the underlying list is also used as a lookup
  // elsewhere, so the API stays unpaginated and we slice the full list here).
  const PAGE_SIZE = 10
  const total = structures.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const pagedStructures = useMemo(
    () => structures.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [structures, page],
  )

  // Keep the current page in range as the list shrinks (e.g. after a delete).
  useEffect(() => {
    if (!isLoading && page > totalPages) setPage(totalPages)
  }, [page, totalPages, isLoading])

  function handleAdd() {
    setEditData(null)
    setFormOpen(true)
  }

  function handleEdit(structure: SalaryStructure) {
    setEditData(structure)
    setFormOpen(true)
  }

  async function handleDeleteConfirm() {
    if (!deleteId) return
    await deleteMutation.mutateAsync(deleteId)
    setDeleteId(null)
  }

  const columns: DataTableColumn<SalaryStructure>[] = [
    {
      header: "Employee",
      cell: (structure) => (
        <div>
          <p className="font-medium">
            {structure.employee.firstName} {structure.employee.lastName}
          </p>
          <p className="text-muted-foreground text-xs">{structure.employee.employeeNo}</p>
          {structure.employee.department && (
            <p className="text-muted-foreground text-xs">{structure.employee.department.name}</p>
          )}
        </div>
      ),
    },
    {
      header: "Basic",
      align: "right",
      cell: (structure) => fmt(structure.basicSalary),
    },
    {
      header: "HRA",
      align: "right",
      className: "text-muted-foreground",
      cell: (structure) => fmt(structure.hra),
    },
    {
      header: "Gross",
      align: "right",
      className: "font-medium",
      cell: (structure) => fmt(grossOf(structure)),
    },
    {
      header: "Net (in-hand)",
      align: "right",
      className: "font-semibold text-emerald-600",
      // No statutory deductions - net is the full gross, paid in hand.
      cell: (structure) => fmt(grossOf(structure)),
    },
    {
      header: "Effective From",
      className: "text-muted-foreground",
      cell: (structure) => formatDate(structure.effectiveFrom),
    },
    ...(can(PERMISSIONS.PAYROLL_WRITE)
      ? [
          {
            header: "",
            align: "right",
            cell: (structure: SalaryStructure) => (
              <div className="flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleEdit(structure)}
                  title="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteId(structure.id)}
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ),
          } satisfies DataTableColumn<SalaryStructure>,
        ]
      : []),
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Salary Structures"
        description="Configure employee salary components and deductions"
        actions={
          can(PERMISSIONS.PAYROLL_WRITE) ? (
            <Button onClick={handleAdd} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Structure
            </Button>
          ) : undefined
        }
      />

      {isLoading ? (
        <TableSkeleton rows={5} cols={7} />
      ) : structures.length === 0 ? (
        <EmptyState
          title="No salary structures configured yet."
          action={
            can(PERMISSIONS.PAYROLL_WRITE)
              ? { label: "Add First Structure", onClick: handleAdd }
              : undefined
          }
        />
      ) : (
        <DataTable
          columns={columns}
          rows={pagedStructures}
          rowKey={(structure) => structure.id}
          showSerial
          serialOffset={(page - 1) * PAGE_SIZE}
          pagination={{
            page,
            totalPages,
            total,
            onPageChange: setPage,
            itemLabel: "structure",
          }}
        />
      )}

      {/* Form dialog */}
      <SalaryStructureForm open={formOpen} onOpenChange={setFormOpen} editData={editData} />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete Salary Structure"
        description="Are you sure you want to delete this salary structure? This action cannot be undone. Salary structures linked to existing payroll records cannot be deleted."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}
