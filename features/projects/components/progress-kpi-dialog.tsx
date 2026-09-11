"use client"

import { useMemo, useState } from "react"
import { Search } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn, formatDate } from "@/lib/utils"
import { DELIVERABLE_STATUS_LABELS, type DeliverableStatus } from "../lib/deliverable-lifecycle"
import type { DeliverablesProgress, ProgressItem } from "../lib/deliverables-progress"

// The popup behind each KPI tile on the Progress page: the rows that make up
// the number, one tab per project (or per person, for anyone looking at a
// team) so a project's rows are a click away instead of a scroll through every
// other project's. "All" keeps the whole list, sectioned, for anyone who wants
// it. Everything here is derived from the payload the page already holds - no
// extra fetch, so what you click on is exactly what the tile counted.

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

const STATUS_TONE: Record<DeliverableStatus, string> = {
  PLANNED: "text-muted-foreground",
  IN_PROGRESS: "text-sky-500",
  DELIVERED: "text-emerald-500",
  ACCEPTED: "text-emerald-600",
  REJECTED: "text-red-500",
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
  // Which tab is open: a project / person key, or ALL for the sectioned list.
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
  // A search can empty the open tab out; fall back to the whole list rather
  // than showing a blank table under a tab that is no longer there.
  const active = groups.some((g) => g.key === tab) ? tab : ALL
  const visible = active === ALL ? groups : groups.filter((g) => g.key === active)
  // Flat list of items for the table (no section headers).
  const flatItems = visible.flatMap((g) => g.items)
  // One project needs no tabs - the header already says what it is.
  const showTabs = groups.length > 1

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
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search deliverable, project, person or reason"
                className="h-8 pl-8 text-sm"
                aria-label="Search this list"
              />
            </div>
            {showTabs ? (
              <Select value={active} onValueChange={setTab}>
                <SelectTrigger className="h-8 w-auto min-w-[160px] gap-1.5 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>
                    All ({shownCount})
                  </SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.key} value={g.key}>
                      {g.label} ({g.items.length})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            {people > 1 ? (
              <Select value={groupBy} onValueChange={(v: string) => changeGroupBy(v as GroupBy)}>
                <SelectTrigger className="h-8 w-auto min-w-[120px] gap-1.5 text-sm">
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
          </div>

          <div className="-mx-1 max-h-[60vh] overflow-y-auto px-1">
            {flatItems.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                Nothing matches &ldquo;{query.trim()}&rdquo;.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-background sticky top-0 z-10">
                  <tr className="text-muted-foreground text-[11px] tracking-wide uppercase">
                    <th className="py-1.5 pr-3 text-left font-medium">Deliverable</th>
                    <th className="py-1.5 pr-3 text-left font-medium">Project</th>
                    <th className="whitespace-nowrap py-1.5 pr-3 text-left font-medium">Owned by</th>
                    <th className="py-1.5 pr-3 text-left font-medium">Period</th>
                    <th className="py-1.5 pr-3 text-left font-medium">Status</th>
                    <th className="py-1.5 text-left font-medium">
                      {finished ? "Completed on" : "Why"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {flatItems.map((it) => (
                    <tr key={it.id} className="border-border/60 border-b align-top">
                      <td className="py-2 pr-3">
                        <span className="text-muted-foreground">{it.type} · </span>
                        {it.title}
                        {it.quantity > 1 ? (
                          <span className="text-muted-foreground"> ×{it.quantity}</span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap">{it.project}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{it.employee ?? "-"}</td>
                      <td
                        className={cn(
                          "py-2 pr-3 whitespace-nowrap",
                          !finished && it.overdue && "text-red-500",
                        )}
                      >
                        {it.period}
                      </td>
                      <td className={cn("py-2 pr-3 whitespace-nowrap", STATUS_TONE[it.status])}>
                        {DELIVERABLE_STATUS_LABELS[it.status]}
                      </td>
                      <td className="py-2">
                        {finished ? (
                          <span className="whitespace-nowrap">
                            {it.completedOn ? formatDate(it.completedOn, "d MMM yyyy") : "-"}
                            {it.late ? (
                              <span className="ml-1.5 text-[11px] text-amber-500">late</span>
                            ) : null}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">{it.why || "-"}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {query.trim() && shownCount !== items.length ? (
            <p className="text-muted-foreground text-xs">
              {shownCount} of {items.length} match.
            </p>
          ) : null}
        </>
      )}
    </>
  )
}
