"use client"

import { useState } from "react"
import { useUrlPage } from "@/hooks/use-url-state"
import Link from "next/link"
import { Plus, Trash2, Inbox } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { Pagination } from "@/components/shared/pagination"
import { EmptyState } from "@/components/shared/empty-state"
import { TableSkeleton } from "@/components/shared/loading-skeleton"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StatusBadge } from "@/components/shared/status-badge"
import { usePermissions } from "@/features/admin"
import { useEmployees } from "@/features/employees"
import { PERMISSIONS, EVALUATION_STATUS_COLORS, EVALUATION_STATUS_LABELS } from "@/lib/constants"
import {
  useEvaluations,
  useCreateEvaluation,
  useDeleteEvaluation,
  type Evaluation,
} from "@/features/performance"

function NewEvaluationDialog() {
  const [open, setOpen] = useState(false)
  const [employeeId, setEmployeeId] = useState("")
  const [managerId, setManagerId] = useState("")
  const [controllerId, setControllerId] = useState("")
  const [periodLabel, setPeriodLabel] = useState("")
  const [dueDate, setDueDate] = useState("")

  const { data: employeesData } = useEmployees({ limit: 100, status: "ACTIVE" })
  const employees = employeesData?.data ?? []
  const create = useCreateEvaluation()

  function reset() {
    setEmployeeId("")
    setManagerId("")
    setControllerId("")
    setPeriodLabel("")
    setDueDate("")
  }

  function handleCreate() {
    create.mutate(
      {
        employeeId,
        managerId: managerId || undefined,
        controllerId: controllerId || undefined,
        periodLabel: periodLabel.trim(),
        dueDate: dueDate || undefined,
      },
      {
        onSuccess: () => {
          reset()
          setOpen(false)
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : (setOpen(false), reset()))}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> New Evaluation
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Performance Evaluation</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Employee *</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select employee…" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.firstName} {e.lastName} - {e.employeeNo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Reviewing Manager</Label>
            <Select value={managerId} onValueChange={setManagerId}>
              <SelectTrigger>
                <SelectValue placeholder="Auto: employee's manager" />
              </SelectTrigger>
              <SelectContent>
                {employees
                  .filter((e) => e.id !== employeeId)
                  .map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.firstName} {e.lastName} - {e.employeeNo}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              Leave blank to use the employee&apos;s assigned manager.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Project Controller (optional)</Label>
            <Select value={controllerId} onValueChange={setControllerId}>
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                {employees
                  .filter((e) => e.id !== employeeId)
                  .map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.firstName} {e.lastName} - {e.employeeNo}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              Adds a 3rd review column. Recorded alongside; doesn&apos;t change the final score.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Period label *</Label>
              <Input
                placeholder="e.g. May end '26"
                value={periodLabel}
                onChange={(e) => setPeriodLabel(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Due date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!employeeId || !periodLabel.trim() || create.isPending}
          >
            {create.isPending ? "Creating…" : "Create & notify"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function EvaluationsPage() {
  const { can } = usePermissions()
  const canReview = can(PERMISSIONS.PERFORMANCE_REVIEW)
  const [page, setPage] = useUrlPage()
  const { data, isLoading } = useEvaluations({ page, limit: 10 })
  const del = useDeleteEvaluation()
  const [deleteTarget, setDeleteTarget] = useState<Evaluation | null>(null)
  const evaluations = data?.data ?? []
  const pagination = data?.pagination

  return (
    <div className="space-y-6">
      <PageHeader
        title="Performance Evaluations"
        description={
          canReview
            ? "Create and track self + manager scorecards."
            : "Your performance evaluations to complete and review."
        }
        actions={
          canReview ? (
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/performance/kpi-profiles">KPI Profiles</Link>
              </Button>
              <NewEvaluationDialog />
            </div>
          ) : undefined
        }
      />

      {isLoading ? (
        <Card>
          <CardContent className="p-0">
            <TableSkeleton rows={3} cols={6} />
          </CardContent>
        </Card>
      ) : evaluations.length === 0 ? (
        <EmptyState icon={Inbox} variant="card" title="No evaluations yet." />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-muted/40 border-b">
                <tr className="text-muted-foreground text-left text-xs">
                  <th className="px-4 py-2.5 font-medium">Employee</th>
                  <th className="px-4 py-2.5 font-medium">Period</th>
                  <th className="px-4 py-2.5 font-medium">Manager</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 text-right font-medium">Score</th>
                  <th className="px-4 py-2.5 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {evaluations.map((ev: Evaluation) => (
                  <tr key={ev.id} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-medium">
                      {ev.employee.firstName} {ev.employee.lastName}
                    </td>
                    <td className="px-4 py-2.5">{ev.periodLabel}</td>
                    <td className="text-muted-foreground px-4 py-2.5">
                      {ev.manager ? `${ev.manager.firstName} ${ev.manager.lastName}` : "-"}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge
                        status={ev.status}
                        colorMap={EVALUATION_STATUS_COLORS}
                        labelMap={EVALUATION_STATUS_LABELS}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                      {ev.finalScore != null ? `${ev.finalScore}/100` : "-"}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/performance/evaluations/${ev.id}`}>Open</Link>
                        </Button>
                        {canReview && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteTarget(ev)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {pagination && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          onPageChange={setPage}
          itemLabel="evaluation"
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete evaluation?"
        description="Delete this evaluation?"
        confirmLabel="Delete"
        variant="destructive"
        isLoading={del.isPending}
        onConfirm={() => {
          if (!deleteTarget) return
          del.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })
        }}
      />
    </div>
  )
}
