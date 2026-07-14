"use client"

import { Save, RefreshCw } from "lucide-react"
import { Spinner } from "@/components/shared/spinner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { ListSkeleton } from "@/components/shared/loading-skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EMPLOYMENT_TYPE_LABELS } from "@/lib/constants"
import {
  policyCellKey,
  type LeavePolicyEditor,
  type PolicyLeaveType,
} from "@/features/leave/hooks/use-leave-policy"

/** Re-sync + Save toolbar. Rendered next to the tabs in the page header; shares
 *  the editor instance with the matrix below it. */
export function LeavePolicyActions({ editor }: { editor: LeavePolicyEditor }) {
  const { dirty, handleSave, saving, resyncPending, resyncOpen, setResyncOpen, confirmResync } =
    editor
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setResyncOpen(true)}
        disabled={resyncPending}
      >
        {resyncPending ? (
          <Spinner size="sm" className="mr-1.5" />
        ) : (
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
        )}
        Sync balances
      </Button>
      <Button size="sm" onClick={handleSave} disabled={!dirty || saving}>
        {saving ? (
          <Spinner size="sm" className="mr-1.5" />
        ) : (
          <Save className="mr-1.5 h-3.5 w-3.5" />
        )}
        Save policy
      </Button>

      <ConfirmDialog
        open={resyncOpen}
        onOpenChange={setResyncOpen}
        title="Sync balances from policy?"
        description="Re-generates this year's leave balances for all active employees from the current policy. Paid leave is granted only to confirmed employees; anyone still on probation gets unpaid leave only. Allocated entitlements are overwritten while used/pending days are preserved, and accrued is never dropped below what's already used. Run this after editing the policy."
        confirmLabel="Sync"
        onConfirm={confirmResync}
        isLoading={resyncPending}
      />
    </>
  )
}

export function LeavePolicyMatrix({ editor }: { editor: LeavePolicyEditor }) {
  const { isLoading, data, values, setCell } = editor

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
            value={values[policyCellKey(et, t.id)] ?? ""}
            onChange={(e) => setCell(et, t.id, e.target.value)}
          />
        ),
      }),
    ),
  ]

  return (
    <DataTable
      columns={columns}
      rows={data.types}
      rowKey={(t) => t.id}
      minWidth="min-w-[640px]"
      showSerial
    />
  )
}
