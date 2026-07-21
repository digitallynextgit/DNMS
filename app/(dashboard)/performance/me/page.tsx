"use client"

import { useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { Star, ChevronRight } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/shared/status-badge"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { EmptyState } from "@/components/shared/empty-state"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EVALUATION_STATUS_COLORS, EVALUATION_STATUS_LABELS } from "@/lib/constants"
import { useEvaluations, type Evaluation } from "@/features/performance"

export default function MyPerformancePage() {
  const { data: session } = useSession()
  const myId = session?.user?.id
  const { data, isLoading } = useEvaluations({ limit: 100 })
  const [period, setPeriod] = useState("")
  const [status, setStatus] = useState("")

  const all = data?.data ?? []
  // Scorecards where I'm the one being evaluated.
  const mine = all.filter((ev) => ev.employeeId === myId)
  // Scorecards I must review for my team (manager or project controller).
  const toReview = all.filter(
    (ev) => ev.employeeId !== myId && (ev.managerId === myId || ev.controllerId === myId),
  )

  const periods = [...new Set([...mine, ...toReview].map((ev) => ev.periodLabel))]
  const applyFilters = (list: Evaluation[]) =>
    list.filter((ev) => (!period || ev.periodLabel === period) && (!status || ev.status === status))
  const mineFiltered = applyFilters(mine)
  const reviewFiltered = applyFilters(toReview)

  // Count of team reviews still awaiting MY input (manager/controller not yet submitted).
  const pendingReview = toReview.filter((ev) =>
    ev.managerId === myId ? !ev.managerSubmittedAt : !ev.controllerSubmittedAt,
  ).length

  const mineColumns: DataTableColumn<Evaluation>[] = [
    { header: "Period", cell: (ev) => <span className="font-medium">{ev.periodLabel}</span> },
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
          <Button asChild size="sm" variant={selfPending ? "default" : "outline"}>
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
          <Button asChild size="sm" variant={done ? "outline" : "default"}>
            <Link href={`/performance/evaluations/${ev.id}`}>
              {done ? "Open" : "Give rating"}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        )
      },
    },
  ]

  const filters = (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={period || "all"} onValueChange={(v) => setPeriod(v === "all" ? "" : v)}>
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
      <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
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
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Performance"
        description="Your own scorecards, and the reviews you owe your team. Open any to rate."
      />

      <Tabs defaultValue="mine" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="mine">My Evaluations</TabsTrigger>
            <TabsTrigger value="review" className="gap-1.5">
              To Review
              {pendingReview > 0 && (
                <Badge className="bg-destructive h-4 min-w-4 px-1 text-[10px] text-white">
                  {pendingReview}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
          {(mine.length > 0 || toReview.length > 0) && filters}
        </div>

        <TabsContent value="mine">
          {isLoading || mineFiltered.length > 0 ? (
            <DataTable
              columns={mineColumns}
              rows={mineFiltered}
              rowKey={(ev) => ev.id}
              showSerial
              minWidth="min-w-[640px]"
              loading={isLoading}
              skeletonRows={4}
            />
          ) : (
            <EmptyState
              icon={Star}
              variant="card"
              title={
                mine.length > 0
                  ? "No evaluations match these filters."
                  : "No performance evaluations assigned to you yet."
              }
            />
          )}
        </TabsContent>

        <TabsContent value="review">
          {isLoading || reviewFiltered.length > 0 ? (
            <DataTable
              columns={reviewColumns}
              rows={reviewFiltered}
              rowKey={(ev) => ev.id}
              showSerial
              minWidth="min-w-[640px]"
              loading={isLoading}
              skeletonRows={4}
            />
          ) : (
            <EmptyState
              icon={Star}
              variant="card"
              title={
                toReview.length > 0
                  ? "No reviews match these filters."
                  : "No team members' evaluations to review."
              }
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
