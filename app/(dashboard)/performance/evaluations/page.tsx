"use client"

import { useState } from "react"
import Link from "next/link"
import { Plus, Trash2, Inbox } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { Pagination } from "@/components/shared/pagination"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
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
import { cn } from "@/lib/utils"
import { usePermissions } from "@/features/admin"
import { useEmployees } from "@/features/employees"
import { PERMISSIONS } from "@/lib/constants"
import {
  useEvaluations,
  useCreateEvaluation,
  useDeleteEvaluation,
  type Evaluation,
} from "@/features/performance"

const STATUS: Record<string, string> = {
  PENDING:
    "border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200",
  SELF_DONE:
    "border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300",
  MANAGER_DONE:
    "border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300",
  COMPLETED:
    "border-green-200 bg-green-100 text-green-700 dark:border-green-900 dark:bg-green-950/50 dark:text-green-300",
}
const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  SELF_DONE: "Self done",
  MANAGER_DONE: "Manager done",
  COMPLETED: "Completed",
}

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
          <div className="space-y-1.5">
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
          <div className="space-y-1.5">
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
          <div className="space-y-1.5">
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
            <div className="space-y-1.5">
              <Label>Period label *</Label>
              <Input
                placeholder="e.g. May end '26"
                value={periodLabel}
                onChange={(e) => setPeriodLabel(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
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
  const [page, setPage] = useState(1)
  const { data, isLoading } = useEvaluations({ page, limit: 10 })
  const del = useDeleteEvaluation()
  const evaluations = data?.data ?? []
  const pagination = data?.pagination

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Performance Evaluations"
          description={
            canReview
              ? "Create and track 15-day self + manager scorecards."
              : "Your performance evaluations to complete and review."
          }
        />
        <div className="flex items-center gap-2">
          {canReview && (
            <Button asChild variant="outline" size="sm">
              <Link href="/performance/evaluations/template">Edit Template</Link>
            </Button>
          )}
          {canReview && <NewEvaluationDialog />}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded" />
          ))}
        </div>
      ) : evaluations.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Inbox className="text-muted-foreground/40 mx-auto mb-2 h-8 w-8" />
            <p className="text-muted-foreground text-sm">No evaluations yet.</p>
          </CardContent>
        </Card>
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
                      {ev.manager ? `${ev.manager.firstName} ${ev.manager.lastName}` : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className={cn("text-xs", STATUS[ev.status])}>
                        {STATUS_LABEL[ev.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                      {ev.finalScore != null ? `${ev.finalScore}/100` : "—"}
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
                            onClick={() => {
                              if (confirm("Delete this evaluation?")) del.mutate(ev.id)
                            }}
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
    </div>
  )
}
