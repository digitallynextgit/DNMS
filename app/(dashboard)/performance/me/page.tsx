"use client"

import { useState } from "react"
import { Link } from "@/components/tenant-link"
import { useSession } from "next-auth/react"
import { Star, ChevronRight } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/shared/status-badge"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { EmptyState } from "@/components/shared/empty-state"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { TableViewMenu } from "@/components/shared/table-view-menu"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { TabsBar } from "@/components/shared/tabs-bar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EVALUATION_STATUS_COLORS, EVALUATION_STATUS_LABELS } from "@/lib/constants"
import { useEvaluations, type Evaluation, PerformanceScale } from "@/features/performance"

const STATUS_ORDER = Object.keys(EVALUATION_STATUS_LABELS)

export default function MyPerformancePage() {
  const { data: session } = useSession()
  const myId = session?.user?.id
  const { data, isLoading } = useEvaluations({ limit: 100 })
  const [period, setPeriod] = useState("")
  const [status, setStatus] = useState("")

  const all = data?.data ?? []
  const mine = all.filter((ev) => ev.employeeId === myId)
  // Scorecards I must review for my team (manager or project controller).
  const toReview = all.filter(
    (ev) => ev.employeeId !== myId && (ev.managerId === myId || ev.controllerId === myId),
  )

  const periods = [...new Set([...mine, ...toReview].map((ev) => ev.periodLabel))]
  const inPeriod = (list: Evaluation[]) => list.filter((ev) => !period || ev.periodLabel === period)
  const applyFilters = (list: Evaluation[]) =>
    inPeriod(list).filter((ev) => !status || ev.status === status)
  const mineFiltered = applyFilters(mine)
  const reviewFiltered = applyFilters(toReview)
  // Only the newest 100 are fetched; say so rather than silently leave the rest out.
  const capped =
    (data?.pagination.total ?? 0) > all.length
      ? `Showing evaluations from the latest ${all.length} - older ones are not listed.`
      : undefined

  // Count of team reviews still awaiting MY input (manager/controller not yet submitted).
  const pendingReview = toReview.filter((ev) =>
    ev.managerId === myId ? !ev.managerSubmittedAt : !ev.controllerSubmittedAt,
  ).length

  // Highlight the employee's band using their most recent scored evaluation.
  const latestScore = mine.find((ev) => ev.finalScore != null)?.finalScore ?? null

  const mineColumns: DataTableColumn<Evaluation>[] = [
    {
      header: "Period",
      // The label is free text ("May end '26"), so sort by when the period starts.
      sortValue: (ev) => ev.periodStart ?? ev.createdAt,
      cell: (ev) => <span className="font-medium">{ev.periodLabel}</span>,
    },
    {
      header: "Status",
      sortValue: (ev) => STATUS_ORDER.indexOf(ev.status),
      cell: (ev) => (
        <StatusBadge
          status={ev.status}
          colorMap={EVALUATION_STATUS_COLORS}
          labelMap={EVALUATION_STATUS_LABELS}
        />
      ),
    },
    {
      header: "Self",
      className: "text-muted-foreground",
      cell: (ev) => (ev.selfSubmittedAt ? "Submitted" : "Pending"),
    },
    {
      header: "Manager",
      cell: (ev) => (
        <div className="min-w-0">
          <p className="truncate">
            {ev.manager ? `${ev.manager.firstName} ${ev.manager.lastName}` : "-"}
          </p>
          <p className="text-muted-foreground text-xs">
            {ev.managerSubmittedAt ? "Reviewed" : "Pending"}
          </p>
        </div>
      ),
    },
    {
      header: "Final score",
      align: "right",
      sortValue: (ev) => ev.finalScore,
      cell: (ev) => (
        <span className="font-semibold tabular-nums">
          {ev.finalScore != null ? (
            <>
              {ev.finalScore}
              <span className="text-muted-foreground text-xs font-normal">/100</span>
            </>
          ) : (
            "-"
          )}
        </span>
      ),
    },
    {
      header: "",
      align: "right",
      cell: (ev) => {
        const selfPending = !ev.selfSubmittedAt
        return (
          <Button asChild variant={selfPending ? "default" : "outline"}>
            <Link href={`/performance/evaluations/${ev.id}`}>
              {selfPending ? "Fill self-evaluation" : "Open"}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        )
      },
    },
  ]

  const reviewColumns: DataTableColumn<Evaluation>[] = [
    {
      header: "Employee",
      sortValue: (ev) => `${ev.employee.firstName} ${ev.employee.lastName}`.trim(),
      cell: (ev) => (
        <div className="flex items-center gap-2">
          <AvatarDisplay
            src={ev.employee.profilePhoto}
            firstName={ev.employee.firstName}
            lastName={ev.employee.lastName}
            size="sm"
            className="shrink-0"
          />
          <div className="min-w-0">
            <p className="truncate font-medium">
              {ev.employee.firstName} {ev.employee.lastName}
            </p>
            <p className="text-muted-foreground text-xs">{ev.periodLabel}</p>
          </div>
        </div>
      ),
    },
    {
      header: "Status",
      sortValue: (ev) => STATUS_ORDER.indexOf(ev.status),
      cell: (ev) => (
        <StatusBadge
          status={ev.status}
          colorMap={EVALUATION_STATUS_COLORS}
          labelMap={EVALUATION_STATUS_LABELS}
        />
      ),
    },
    {
      header: "Self",
      className: "text-muted-foreground",
      cell: (ev) => (ev.selfSubmittedAt ? "Submitted" : "Pending"),
    },
    {
      header: "My review",
      className: "text-muted-foreground",
      cell: (ev) => {
        const done = ev.managerId === myId ? ev.managerSubmittedAt : ev.controllerSubmittedAt
        return done ? "Submitted" : "Pending"
      },
    },
    {
      header: "",
      align: "right",
      cell: (ev) => {
        const done = ev.managerId === myId ? ev.managerSubmittedAt : ev.controllerSubmittedAt
        return (
          <Button asChild variant={done ? "outline" : "default"}>
            <Link href={`/performance/evaluations/${ev.id}`}>
              {done ? "Open" : "Give rating"}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        )
      },
    },
  ]

  // Period and status are shared by both tabs; each table shows them with its own counts.
  const filters = (list: Evaluation[]) => (
    <>
      <TableViewMenu
        label="Status"
        value={status || "ALL"}
        options={[
          { value: "ALL", label: "All", count: inPeriod(list).length },
          ...Object.entries(EVALUATION_STATUS_LABELS).map(([value, label]) => ({
            value,
            label,
            count: inPeriod(list).filter((ev) => ev.status === value).length,
          })),
        ]}
        onChange={(v) => setStatus(v === "ALL" ? "" : v)}
      />
      <Select value={period || "all"} onValueChange={(v) => setPeriod(v === "all" ? "" : v)}>
        <SelectTrigger className="h-9 w-[170px]" aria-label="Period">
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
    </>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Performance"
        description="Your own scorecards, and the reviews you owe your team. Open any to rate."
      />

      <Tabs defaultValue="mine" className="space-y-4">
        <TabsBar
          spacing="none"
          items={[
            { value: "mine", label: "My Evaluations" },
            { value: "review", label: "To Review", badge: pendingReview },
          ]}
        />

        <TabsContent value="mine">
          {isLoading || mine.length > 0 ? (
            <DataTable
              tableId="my-evaluations"
              itemLabel="evaluation"
              columns={mineColumns}
              rows={mineFiltered}
              rowKey={(ev) => ev.id}
              showSerial
              minWidth="min-w-[640px]"
              loading={isLoading}
              skeletonRows={4}
              pageKey={`${period}|${status}`}
              toolbar={filters(mine)}
              empty="No evaluations match these filters."
              footerNote={capped}
            />
          ) : (
            <EmptyState
              icon={Star}
              variant="card"
              title="No performance evaluations assigned to you yet."
            />
          )}
        </TabsContent>

        <TabsContent value="review">
          {isLoading || toReview.length > 0 ? (
            <DataTable
              tableId="my-team-reviews"
              itemLabel="review"
              columns={reviewColumns}
              rows={reviewFiltered}
              rowKey={(ev) => ev.id}
              showSerial
              minWidth="min-w-[640px]"
              loading={isLoading}
              skeletonRows={4}
              pageKey={`${period}|${status}`}
              toolbar={filters(toReview)}
              empty="No reviews match these filters."
              footerNote={capped}
            />
          ) : (
            <EmptyState
              icon={Star}
              variant="card"
              title="No team members' evaluations to review."
            />
          )}
        </TabsContent>
      </Tabs>

      <PerformanceScale highlightPct={latestScore} />
    </div>
  )
}
