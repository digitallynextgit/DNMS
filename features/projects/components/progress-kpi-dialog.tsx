"use client"

import { useMemo, useState } from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { TableSearch } from "@/components/shared/table-search"
import { TableViewMenu } from "@/components/shared/table-view-menu"
import { cn, formatDate } from "@/lib/utils"
import {
  DELIVERABLE_STATUS_LABELS,
  STATUS_ORDER,
  type DeliverableStatus,
} from "../lib/deliverable-lifecycle"
import type { DeliverablesProgress, ProgressItem } from "../lib/deliverables-progress"

// Derived from the page's payload - no extra fetch, so the rows match what the tile counted.

const ALL = "all"

export type KpiKey = "todo" | "completed" | "overdue" | "sentBack"

const KPI: Record<
  KpiKey,
  {
    title: string
    blurb: string
    expected: (t: DeliverablesProgress["totals"]) => number
    pick: (d: DeliverablesProgress) => ProgressItem[]
  }
> = {
  todo: {
    title: "To do",
    blurb: "Still open in this window - planned, in progress or sent back.",
    expected: (t) => t.open,
    pick: (d) => d.notDone,
  },
  completed: {
    title: "Completed",
    blurb: "Delivered or accepted in this window.",
    expected: (t) => t.done,
    pick: (d) => d.delivered,
  },
  overdue: {
    title: "Overdue now",
    blurb: "Past the due date and still open.",
    expected: (t) => t.overdue,
    pick: (d) => d.notDone.filter((i) => i.overdue),
  },
  sentBack: {
    title: "Sent back",
    blurb: "Returned by the account manager and waiting for rework.",
    expected: (t) => t.sentBack,
    pick: (d) => d.notDone.filter((i) => i.status === "REJECTED"),
  },
}

// Keep in step with DELIVERABLE_STATUS_CHIP.
const STATUS_TONE: Record<DeliverableStatus, string> = {
  PLANNED: "text-muted-foreground",
  IN_PROGRESS: "text-blue-500",
  DELIVERED: "text-green-500",
  ACCEPTED: "text-emerald-500",
  REJECTED: "text-orange-500",
  STUCK: "text-amber-500",
  DISCARDED: "text-red-500",
}

type GroupBy = "project" | "person"

const GROUP_OPTIONS = [
  { value: "project", label: "By project" },
  { value: "person", label: "By person" },
] as const satisfies readonly { value: GroupBy; label: string }[]

export function ProgressKpiDialog({
  kpi,
  data,
  onClose,
}: {
  kpi: KpiKey | null
  data: DeliverablesProgress
  onClose: () => void
}) {
  return (
    <Dialog open={kpi !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl">
        {/* Keyed so search and grouping reset when a different tile is opened. */}
        {kpi ? <KpiBody key={kpi} kpi={kpi} data={data} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function KpiBody({ kpi, data }: { kpi: KpiKey; data: DeliverablesProgress }) {
  const spec = KPI[kpi]
  const items = useMemo(() => spec.pick(data), [spec, data])
  const expected = spec.expected(data.totals)
  const people = useMemo(() => new Set(items.map((i) => i.employeeId ?? "-")).size, [items])
  const finished = kpi === "completed"

  const [query, setQuery] = useState("")
  const [groupBy, setGroupBy] = useState<GroupBy>("project")
  const [tab, setTab] = useState(ALL)
  const changeGroupBy = (g: GroupBy) => {
    setGroupBy(g)
    setTab(ALL)
  }

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const shown = q
      ? items.filter((i) =>
          [i.title, i.type, i.project, i.employee ?? "", i.why].some((s) =>
            s.toLowerCase().includes(q),
          ),
        )
      : items
    const map = new Map<string, { key: string; label: string; items: ProgressItem[] }>()
    for (const it of shown) {
      const key = groupBy === "project" ? it.projectId : (it.employeeId ?? "-")
      const label = groupBy === "project" ? it.project : (it.employee ?? "Unassigned")
      const g = map.get(key) ?? { key, label, items: [] }
      g.items.push(it)
      map.set(key, g)
    }
    // Biggest groups first; ties alphabetical so the order is stable.
    return [...map.values()].sort(
      (a, b) => b.items.length - a.items.length || a.label.localeCompare(b.label),
    )
  }, [items, query, groupBy])

  const shownCount = groups.reduce((n, g) => n + g.items.length, 0)
  // A search can empty the open tab; fall back to the whole list.
  const active = groups.some((g) => g.key === tab) ? tab : ALL
  const visible = active === ALL ? groups : groups.filter((g) => g.key === active)
  const flatItems = visible.flatMap((g) => g.items)
  const showTabs = groups.length > 1

  const columns: DataTableColumn<ProgressItem>[] = [
    {
      header: "Deliverable",
      sortValue: (it) => it.title,
      className: "max-w-[280px] truncate",
      cell: (it) => (
        <span title={`${it.type} · ${it.title}`}>
          <span className="text-muted-foreground">{it.type} · </span>
          {it.title}
          {it.quantity > 1 ? <span className="text-muted-foreground"> ×{it.quantity}</span> : null}
        </span>
      ),
    },
    { header: "Project", sortValue: (it) => it.project, cell: (it) => it.project },
    { header: "Owned by", sortValue: (it) => it.employee, cell: (it) => it.employee ?? "-" },
    {
      header: "Period",
      sortValue: (it) => it.dueOn,
      cell: (it) => (
        <span className={cn(!finished && it.overdue && "text-red-500")}>{it.period}</span>
      ),
    },
    {
      header: "Status",
      sortValue: (it) => STATUS_ORDER.indexOf(it.status),
      cell: (it) => (
        <span className={STATUS_TONE[it.status]}>{DELIVERABLE_STATUS_LABELS[it.status]}</span>
      ),
    },
    finished
      ? {
          header: "Completed on",
          sortValue: (it) => it.completedOn,
          cell: (it) => (
            <>
              {it.completedOn ? formatDate(it.completedOn, "d MMM yyyy") : "-"}
              {it.late ? <span className="ml-1.5 text-[11px] text-amber-500">late</span> : null}
            </>
          ),
        }
      : {
          header: "Why",
          // The reason is the point of this list, so it wraps rather than truncates.
          className: "text-muted-foreground min-w-[240px] whitespace-normal",
          cell: (it) => it.why || "-",
        },
  ]

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-baseline gap-2">
          {spec.title}
          <span className="text-muted-foreground text-base font-normal tabular-nums">
            {items.length}
          </span>
        </DialogTitle>
        <DialogDescription>
          {spec.blurb}
          {items.length < expected
            ? ` Showing ${items.length} of ${expected} - narrow the window to see all of them.`
            : null}
        </DialogDescription>
      </DialogHeader>

      {items.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">
          Nothing here for this window.
        </p>
      ) : (
        // Every row in a scroll box, as before: a dialog list is read top to bottom, not paged.
        <DataTable
          columns={columns}
          rows={flatItems}
          rowKey={(it) => it.id}
          maxHeight="max-h-[60vh]"
          pageSize={false}
          columnToggle={false}
          itemLabel="deliverable"
          toolbar={
            <>
              <TableSearch
                value={query}
                onChange={setQuery}
                placeholder="Search deliverable, project, person or reason"
                label="Search this list"
              />
              {showTabs ? (
                <TableViewMenu
                  label={groupBy === "project" ? "Project" : "Person"}
                  value={active}
                  options={[
                    { value: ALL, label: "All", count: shownCount },
                    ...groups.map((g) => ({ value: g.key, label: g.label, count: g.items.length })),
                  ]}
                  onChange={setTab}
                />
              ) : null}
              {people > 1 ? (
                <Select value={groupBy} onValueChange={(v: string) => changeGroupBy(v as GroupBy)}>
                  <SelectTrigger className="h-9 w-auto min-w-[130px] gap-1.5" aria-label="Group">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GROUP_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
            </>
          }
          empty={<>Nothing matches &ldquo;{query.trim()}&rdquo;.</>}
          footerNote={
            query.trim() && shownCount !== items.length
              ? `${shownCount} of ${items.length} match.`
              : undefined
          }
        />
      )}
    </>
  )
}
