"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useTenantPath } from "@/components/tenant-link"
import { useSession } from "next-auth/react"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/page-header"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { EmptyState } from "@/components/shared/empty-state"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { SalaryStructureForm } from "@/features/payroll"
import {
  useSalaryStructures,
  useDeleteSalaryStructure,
  type SalaryStructure,
} from "@/features/payroll"
import { usePermissions } from "@/features/admin/hooks/use-permissions"
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
  const tp = useTenantPath()
  const { status: sessionStatus } = useSession()
  const canWrite = can(PERMISSIONS.PAYROLL_WRITE)

  // HR-only page; employees use My Payslips.
  useEffect(() => {
    if (sessionStatus === "authenticated" && !canWrite) {
      router.replace(tp("/payroll/me"))
    }
  }, [sessionStatus, canWrite, router])

  const [formOpen, setFormOpen] = useState(false)
  const [editData, setEditData] = useState<SalaryStructure | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data, isLoading } = useSalaryStructures()
  const deleteMutation = useDeleteSalaryStructure()

  const structures = data?.data ?? []

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
    try {
      await deleteMutation.mutateAsync(deleteId)
      setDeleteId(null)
    } catch {
      // the mutation hook already toasts the error; just keep the form open
    }
  }

  const columns: DataTableColumn<SalaryStructure>[] = [
    {
      header: "Employee",
      sortValue: (structure) =>
        `${structure.employee.firstName} ${structure.employee.lastName}`.trim(),
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
      header: "Employee No",
      defaultHidden: true,
      className: "font-mono text-xs",
      sortValue: (structure) => structure.employee.employeeNo,
      cell: (structure) => structure.employee.employeeNo,
    },
    {
      header: "Basic",
      align: "right",
      sortValue: (structure) => structure.basicSalary,
      cell: (structure) => fmt(structure.basicSalary),
    },
    {
      header: "HRA",
      align: "right",
      className: "text-muted-foreground",
      sortValue: (structure) => structure.hra,
      cell: (structure) => fmt(structure.hra),
    },
    {
      header: "Gross",
      align: "right",
      className: "font-medium",
      sortValue: grossOf,
      cell: (structure) => fmt(grossOf(structure)),
    },
    {
      header: "Net (in-hand)",
      align: "right",
      className: "font-semibold text-emerald-600",
      // No statutory deductions - net is the full gross, paid in hand.
      sortValue: grossOf,
      cell: (structure) => fmt(grossOf(structure)),
    },
    {
      header: "Effective From",
      className: "text-muted-foreground",
      sortValue: (structure) => structure.effectiveFrom,
      exportValue: (structure) => structure.effectiveFrom.slice(0, 10),
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
                  size="icon"
                  onClick={() => handleEdit(structure)}
                  title="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
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
            <Button className="gap-2" onClick={handleAdd}>
              <Plus className="h-4 w-4" />
              Add Structure
            </Button>
          ) : undefined
        }
      />

      {isLoading || structures.length > 0 ? (
        <DataTable
          tableId="salary-structures"
          exportName="salary-structures"
          itemLabel="structure"
          columns={columns}
          rows={structures}
          rowKey={(structure) => structure.id}
          showSerial
          loading={isLoading}
          skeletonRows={10}
        />
      ) : (
        <EmptyState
          title="No salary structures configured yet."
          action={
            can(PERMISSIONS.PAYROLL_WRITE)
              ? { label: "Add First Structure", onClick: handleAdd }
              : undefined
          }
        />
      )}

      <SalaryStructureForm open={formOpen} onOpenChange={setFormOpen} editData={editData} />

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
