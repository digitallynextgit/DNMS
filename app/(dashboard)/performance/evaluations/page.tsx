"use client"

import { useState } from "react"
import { useUrlPage } from "@/hooks/use-url-state"
import Link from "next/link"
import { Plus, Trash2, Inbox, Sparkles, Search } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { EmptyState } from "@/components/shared/empty-state"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { FormDialog } from "@/components/shared/form-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  useGenerateEvaluations,
  useDeleteEvaluation,
  type Evaluation,
} from "@/features/performance"

const PAGE_SIZE = 10

/** One-click: create today's evaluation for every active employee + notify them. */
function GenerateEvaluationsButton() {
  const [confirm, setConfirm] = useState(false)
  const generate = useGenerateEvaluations()
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => setConfirm(true)}
        disabled={generate.isPending}
      >
        <Sparkles className="h-4 w-4" /> Generate Evaluations
      </Button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Generate evaluations for everyone?"
        description="This creates today's performance evaluation for every active employee and notifies each of them (and their manager). Anyone who already has one for today is skipped."
        confirmLabel="Generate & notify"
        isLoading={generate.isPending}
        onConfirm={() => generate.mutate(undefined, { onSuccess: () => setConfirm(false) })}
      />
    </>
  )
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

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
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
    <>
      <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> New Evaluation
      </Button>
      <FormDialog
        open={open}
        onOpenChange={(o) => (o ? setOpen(true) : (setOpen(false), reset()))}
        title="New Performance Evaluation"
        isPending={create.isPending}
        submitDisabled={!employeeId || !periodLabel.trim()}
        submitLabel="Create & notify"
        size="sm"
        onSubmit={handleCreate}
      >
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
      </FormDialog>
    </>
  )
}

export default function EvaluationsPage() {
  const { can } = usePermissions()
  const canReview = can(PERMISSIONS.PERFORMANCE_REVIEW)
  const [page, setPage] = useUrlPage()
  const [q, setQ] = useState("")
  const [period, setPeriod] = useState("")
  const [status, setStatus] = useState("")
  const { data, isLoading } = useEvaluations({
    page,
    limit: PAGE_SIZE,
    q,
    period: period || undefined,
    status: status || undefined,
  })
  const del = useDeleteEvaluation()
  const [deleteTarget, setDeleteTarget] = useState<Evaluation | null>(null)
  const evaluations = data?.data ?? []
  const periods = data?.periods ?? []
  const pagination = data?.pagination

  // Reset to the first page whenever a filter changes.
  function onFilter<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v)
      setPage(1)
    }
  }

  const columns: DataTableColumn<Evaluation>[] = [
    {
      header: "Employee",
      className: "font-medium",
      cell: (ev) => (
        <>
          {ev.employee.firstName} {ev.employee.lastName}
        </>
      ),
    },
    {
      header: "Period",
      cell: (ev) => ev.periodLabel,
    },
    {
      header: "Manager",
      className: "text-muted-foreground",
      cell: (ev) => (ev.manager ? `${ev.manager.firstName} ${ev.manager.lastName}` : "-"),
    },
    {
      header: "Status",
      cell: (ev) => (
        <StatusBadge
          status={ev.status}
          colorMap={EVALUATION_STATUS_COLORS}
          labelMap={EVALUATION_STATUS_LABELS}
        />
      ),
    },
    {
      header: "Score",
      align: "right",
      className: "font-semibold tabular-nums",
      cell: (ev) => (ev.finalScore != null ? `${ev.finalScore}/100` : "-"),
    },
    {
      header: "",
      align: "right",
      cell: (ev) => (
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
      ),
    },
  ]

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
              <GenerateEvaluationsButton />
              <NewEvaluationDialog />
            </div>
          ) : undefined
        }
      />

      {canReview && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
            <Input
              value={q}
              onChange={(e) => onFilter(setQ)(e.target.value)}
              placeholder="Search employee…"
              className="pl-8"
            />
          </div>
          <Select
            value={period || "all"}
            onValueChange={(v) => onFilter(setPeriod)(v === "all" ? "" : v)}
          >
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="All periods" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All periods</SelectItem>
              {periods.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={status || "all"}
            onValueChange={(v) => onFilter(setStatus)(v === "all" ? "" : v)}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.entries(EVALUATION_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* The table renders from the first paint: while `isLoading` it draws
          skeleton rows inside its own real <thead>, derived from `columns`, so
          the placeholder always has the right column count and alignment. */}
      {isLoading || evaluations.length > 0 ? (
        <DataTable
          columns={columns}
          rows={evaluations}
          rowKey={(ev) => ev.id}
          showSerial
          serialOffset={(page - 1) * PAGE_SIZE}
          minWidth="min-w-[680px]"
          loading={isLoading}
          skeletonRows={PAGE_SIZE}
          pagination={
            pagination
              ? {
                  page: pagination.page,
                  totalPages: pagination.totalPages,
                  total: pagination.total,
                  onPageChange: setPage,
                  itemLabel: "evaluation",
                }
              : undefined
          }
        />
      ) : (
        <EmptyState icon={Inbox} variant="card" title="No evaluations yet." />
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
