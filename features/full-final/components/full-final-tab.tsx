"use client"

import { useMemo, useState } from "react"
import { Plus } from "lucide-react"

import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { StatStrip } from "@/components/shared/stat-strip"
import { StatusBadge } from "@/components/shared/status-badge"
import { SegmentedControl } from "@/components/shared/segmented-control"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { Link } from "@/components/tenant-link"
import { Button } from "@/components/ui/button"
import { employeeSlug, formatDate } from "@/lib/utils"
import { useFullFinal } from "../hooks/use-full-final"
import { NOTICE_LABEL, fnfStatusLabel, type FnfState } from "../lib/fnf"
import type { FullFinalRow } from "../types"
import { FullFinalDialog } from "./full-final-dialog"

const STATE_CLASS: Record<FnfState, string> = {
  OVERDUE: "bg-destructive/15 text-destructive",
  DUE_SOON: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  PENDING: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  RELEASED: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  RELEASED_LATE: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
}

type Filter = "open" | "overdue" | "released" | "all"
const FILTERS = [
  { value: "open", label: "Open" },
  { value: "overdue", label: "Overdue" },
  { value: "released", label: "Released" },
  { value: "all", label: "All" },
] as const

const day = (d: string | null) => (d ? formatDate(d, "d MMM yyyy") : "-")
const isOpen = (r: FullFinalRow) => !r.releasedOn

function EmployeeCell({ row }: { row: FullFinalRow }) {
  const e = row.employee
  if (!e) {
    return (
      <span className="flex flex-col">
        <span className="font-medium">{row.name}</span>
        <span className="text-muted-foreground text-[11px]">Left before DNMS</span>
      </span>
    )
  }
  return (
    <Link
      href={`/employees/${employeeSlug(e.employeeNo, e.firstName, e.lastName)}`}
      onClick={(ev) => ev.stopPropagation()}
      className="group flex items-center gap-2.5"
    >
      <AvatarDisplay src={e.profilePhoto} firstName={e.firstName} lastName={e.lastName} size="sm" />
      <span className="flex flex-col">
        <span className="font-medium underline-offset-4 group-hover:underline">{row.name}</span>
        <span className="text-muted-foreground font-mono text-[11px]">{e.employeeNo}</span>
      </span>
    </Link>
  )
}

/** Exit Clearance > Full & Final: every leaver's settlement, from last day to relieving letter. */
export function FullFinalTab({ canWrite }: { canWrite: boolean }) {
  const { data: rows, isLoading } = useFullFinal()
  const [filter, setFilter] = useState<Filter>("open")
  // undefined: closed; null: adding; a row: editing it.
  const [editing, setEditing] = useState<FullFinalRow | null | undefined>(undefined)

  const all = useMemo(() => rows ?? [], [rows])
  const shown = useMemo(() => {
    if (filter === "open") return all.filter(isOpen)
    if (filter === "overdue") return all.filter((r) => r.status.state === "OVERDUE")
    if (filter === "released") return all.filter((r) => !isOpen(r))
    return all
  }, [all, filter])

  const stats = [
    { label: "Open", value: all.filter(isOpen).length },
    {
      label: "Due within 7 days",
      value: all.filter((r) => r.status.state === "DUE_SOON").length,
      tone: "warning" as const,
    },
    {
      label: "Overdue",
      value: all.filter((r) => r.status.state === "OVERDUE").length,
      tone: "danger" as const,
    },
    { label: "Released", value: all.filter((r) => !isOpen(r)).length },
  ]

  const columns: DataTableColumn<FullFinalRow>[] = [
    {
      header: "Employee",
      sortValue: (r) => r.name,
      exportValue: (r) => r.name,
      cell: (r) => <EmployeeCell row={r} />,
    },
    {
      header: "Designation",
      className: "text-muted-foreground",
      sortValue: (r) => r.designation,
      exportValue: (r) => r.designation ?? "",
      cell: (r) => r.designation ?? "-",
    },
    {
      header: "Last working day",
      sortValue: (r) => r.lastWorkingDate,
      exportValue: (r) => r.lastWorkingDate,
      cell: (r) => <span className="tabular-nums">{day(r.lastWorkingDate)}</span>,
    },
    {
      header: "FnF due by",
      sortValue: (r) => r.dueDate,
      exportValue: (r) => r.dueDate,
      cell: (r) => <span className="tabular-nums">{day(r.dueDate)}</span>,
    },
    {
      header: "FnF released on",
      sortValue: (r) => r.releasedOn,
      exportValue: (r) => r.releasedOn ?? "",
      cell: (r) => <span className="tabular-nums">{day(r.releasedOn)}</span>,
    },
    {
      header: "Status",
      sortValue: (r) => (r.status.state === "OVERDUE" ? -r.status.days : r.status.days),
      exportValue: (r) => fnfStatusLabel(r.status),
      cell: (r) => (
        <StatusBadge
          status={r.status.state}
          colorMap={STATE_CLASS}
          label={fnfStatusLabel(r.status)}
        />
      ),
    },
    {
      header: "Notice period",
      sortValue: (r) => r.noticePeriod,
      exportValue: (r) => (r.noticePeriod ? NOTICE_LABEL[r.noticePeriod] : ""),
      cell: (r) =>
        r.noticePeriod ? (
          NOTICE_LABEL[r.noticePeriod]
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      header: "Relieving letter",
      sortValue: (r) => (r.relievingGiven ? 1 : 0),
      exportValue: (r) =>
        r.relievingGiven ? `Given${r.relievingDate ? ` ${r.relievingDate}` : ""}` : "Not yet",
      cell: (r) =>
        r.relievingGiven ? (
          <span className="flex flex-col">
            <span className="font-medium text-emerald-700 dark:text-emerald-400">Given</span>
            {r.relievingDate ? (
              <span className="text-muted-foreground text-[11px] tabular-nums">
                {day(r.relievingDate)}
              </span>
            ) : null}
          </span>
        ) : (
          <span className="text-muted-foreground">Not yet</span>
        ),
    },
    {
      header: "Notes",
      defaultHidden: true,
      className: "text-muted-foreground max-w-64 truncate",
      exportValue: (r) => r.notes ?? "",
      cell: (r) => <span title={r.notes ?? undefined}>{r.notes ?? "-"}</span>,
    },
  ]

  return (
    <div className="space-y-4">
      <StatStrip items={stats} loading={isLoading} />

      <DataTable
        tableId="full-final"
        columns={columns}
        rows={shown}
        rowKey={(r) => r.id}
        loading={isLoading}
        skeletonRows={5}
        showSerial
        exportName="full-and-final"
        itemLabel="leavers"
        onRowClick={canWrite ? (r) => setEditing(r) : undefined}
        toolbar={
          <SegmentedControl
            value={filter}
            onChange={setFilter}
            options={FILTERS}
            aria-label="Show"
          />
        }
        toolbarEnd={
          canWrite ? (
            <Button className="gap-1.5" onClick={() => setEditing(null)}>
              <Plus className="h-3.5 w-3.5" />
              Add leaver
            </Button>
          ) : null
        }
        empty={
          filter === "open"
            ? "No settlement is open."
            : filter === "overdue"
              ? "Nothing is overdue."
              : "Nobody here yet."
        }
      />

      {editing !== undefined && (
        <FullFinalDialog
          key={editing?.id ?? "new"}
          open
          onOpenChange={(open) => {
            if (!open) setEditing(undefined)
          }}
          row={editing}
        />
      )}
    </div>
  )
}
