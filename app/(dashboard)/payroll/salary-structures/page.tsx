"use client"

import { useState, useEffect, useMemo } from "react"
import { useUrlPage } from "@/hooks/use-url-state"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/page-header"
import { Pagination } from "@/components/shared/pagination"
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
        <div className="bg-card rounded border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b">
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Employee</th>
                <th className="text-muted-foreground px-4 py-3 text-right font-medium">Basic</th>
                <th className="text-muted-foreground px-4 py-3 text-right font-medium">HRA</th>
                <th className="text-muted-foreground px-4 py-3 text-right font-medium">Gross</th>
                <th className="text-muted-foreground px-4 py-3 text-right font-medium">
                  Net (in-hand)
                </th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">
                  Effective From
                </th>
                {can(PERMISSIONS.PAYROLL_WRITE) && (
                  <th className="text-muted-foreground px-4 py-3 text-right font-medium">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              {pagedStructures.map((structure: SalaryStructure) => {
                const gross =
                  structure.basicSalary +
                  structure.hra +
                  structure.conveyance +
                  structure.medicalAllowance +
                  structure.telephoneAllowance +
                  structure.otherAllowances
                // No statutory deductions - net is the full gross, paid in hand.
                const net = gross

                return (
                  <tr key={structure.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">
                          {structure.employee.firstName} {structure.employee.lastName}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {structure.employee.employeeNo}
                        </p>
                        {structure.employee.department && (
                          <p className="text-muted-foreground text-xs">
                            {structure.employee.department.name}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">{fmt(structure.basicSalary)}</td>
                    <td className="text-muted-foreground px-4 py-3 text-right">
                      {fmt(structure.hra)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{fmt(gross)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                      {fmt(net)}
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      {formatDate(structure.effectiveFrom)}
                    </td>
                    {can(PERMISSIONS.PAYROLL_WRITE) && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEdit(structure)}
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive h-8 w-8"
                            onClick={() => setDeleteId(structure.id)}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!isLoading && (
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          onPageChange={setPage}
          itemLabel="structure"
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
