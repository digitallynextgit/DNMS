"use client"

import { useEffect, useState } from "react"
import { Loader2, Save, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { ListSkeleton } from "@/components/shared/loading-skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EMPLOYMENT_TYPE_LABELS } from "@/lib/constants"
import {
  useLeavePolicies,
  useSaveLeavePolicies,
  useResyncBalances,
  type PolicyLeaveType,
} from "@/features/leave/hooks/use-leave-policy"

const cellKey = (employmentType: string, leaveTypeId: string) => `${employmentType}__${leaveTypeId}`

export function LeavePolicyMatrix() {
  const { data, isLoading } = useLeavePolicies()
  const save = useSaveLeavePolicies()
  const resync = useResyncBalances()

  const [values, setValues] = useState<Record<string, string>>({})
  const [dirty, setDirty] = useState(false)
  const [resyncOpen, setResyncOpen] = useState(false)

  // Seed the grid from saved policies (until the user starts editing).
  useEffect(() => {
    if (!data || dirty) return
    const next: Record<string, string> = {}
    for (const p of data.policies)
      next[cellKey(p.employmentType, p.leaveTypeId)] = String(p.daysPerYear)
    setValues(next)
  }, [data, dirty])

  function setCell(employmentType: string, leaveTypeId: string, v: string) {
    setDirty(true)
    setValues((prev) => ({ ...prev, [cellKey(employmentType, leaveTypeId)]: v }))
  }

  function handleSave() {
    if (!data) return
    const entries = data.employmentTypes.flatMap((et) =>
      data.types.map((t) => {
        const raw = values[cellKey(et, t.id)]
        const daysPerYear = raw === undefined || raw === "" ? null : Number(raw)
        return { employmentType: et, leaveTypeId: t.id, daysPerYear }
      }),
    )
    save.mutate(entries, { onSuccess: () => setDirty(false) })
  }

  if (isLoading) return <ListSkeleton rows={6} height="h-12" />
  if (!data || data.types.length === 0)
    return <EmptyState variant="card" title="No active leave types to configure." />

  const empTypes = data.employmentTypes
  const columns: DataTableColumn<PolicyLeaveType>[] = [
    {
      header: "Leave Type",
      cell: (t) => (
        <div className="min-w-[160px]">
          <p className="font-medium">{t.name}</p>
          <div className="mt-0.5 flex items-center gap-1.5">
            <code className="bg-muted rounded px-1 py-0.5 font-mono text-[10px]">{t.code}</code>
            <Badge variant="outline" className="text-[10px]">
              {t.accrualMethod === "UPFRONT" ? "Upfront" : "Monthly"}
            </Badge>
          </div>
        </div>
      ),
    },
    ...empTypes.map(
      (et): DataTableColumn<PolicyLeaveType> => ({
        header: EMPLOYMENT_TYPE_LABELS[et] ?? et,
        align: "center",
        cell: (t) => (
          <Input
            type="number"
            min={0}
            step="0.5"
            inputMode="decimal"
            className="mx-auto h-8 w-20 text-center"
            placeholder={String(t.maxDaysPerYear)}
            value={values[cellKey(et, t.id)] ?? ""}
            onChange={(e) => setCell(et, t.id, e.target.value)}
          />
        ),
      }),
    ),
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          Days per year by employment type. Empty cell falls back to the type&apos;s default (shown
          as placeholder). Monthly types drip 1/12 each month; upfront types are fully available at
          grant.
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setResyncOpen(true)}
            disabled={resync.isPending}
          >
            {resync.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            )}
            Re-sync balances
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!dirty || save.isPending}>
            {save.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-3.5 w-3.5" />
            )}
            Save policy
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={data.types}
        rowKey={(t) => t.id}
        minWidth="min-w-[640px]"
        showSerial
      />

      <ConfirmDialog
        open={resyncOpen}
        onOpenChange={setResyncOpen}
        title="Re-sync balances from policy?"
        description="Re-generates this year's leave balances for all active employees from the current policy. Allocated entitlements are overwritten; used/pending days are preserved. Run this after editing the policy."
        confirmLabel="Re-sync"
        onConfirm={() => resync.mutate(undefined, { onSuccess: () => setResyncOpen(false) })}
        isLoading={resync.isPending}
      />
    </div>
  )
}
