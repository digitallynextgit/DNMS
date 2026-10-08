"use client"

// AUDIT_READ is enforced by the API and the middleware; this page only fetches and renders.

import { useEffect, useState, useCallback } from "react"
import { useUrlPage } from "@/hooks/use-url-state"
import { toast } from "sonner"
import { Search, RefreshCw } from "lucide-react"
import { format } from "date-fns"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { EmptyState } from "@/components/shared/empty-state"
import { DateField } from "@/components/shared/date-field"
import { PageHeader } from "@/components/shared/page-header"
import { MODULES } from "@/lib/constants"

interface AuditEntry {
  id: string
  action: string
  module: string
  entityType: string | null
  entityId: string | null
  ipAddress: string | null
  createdAt: string
  actor: {
    id: string
    firstName: string
    lastName: string
    employeeNo: string
    profilePhoto: string | null
  } | null
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

const ALL_MODULES_VALUE = "__all__"

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  })
  const [loading, setLoading] = useState(true)

  const [moduleFilter, setModuleFilter] = useState<string>("")
  const [actionFilter, setActionFilter] = useState<string>("")
  const [dateFrom, setDateFrom] = useState<string>("")
  const [dateTo, setDateTo] = useState<string>("")
  const [page, setPage] = useUrlPage()

  // Sets state only in the promise callbacks; `loading` is raised by the caller.
  const fetchEntries = useCallback(() => {
    const params = new URLSearchParams()
    params.set("page", String(page))
    params.set("limit", "10")
    if (moduleFilter) params.set("module", moduleFilter)
    if (actionFilter) params.set("action", actionFilter)
    if (dateFrom) params.set("dateFrom", dateFrom)
    if (dateTo) params.set("dateTo", dateTo)

    return fetch(`/api/audit-log?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch audit log")
        const json = await res.json()
        setEntries(json.data)
        setPagination(json.pagination)
      })
      .catch(() => {
        toast.error("Could not load audit log")
      })
      .finally(() => setLoading(false))
  }, [page, moduleFilter, actionFilter, dateFrom, dateTo])

  // A new page or filter shows the skeleton straight away; the effect below refetches it.
  const queryKey = JSON.stringify([page, moduleFilter, actionFilter, dateFrom, dateTo])
  const [prevQueryKey, setPrevQueryKey] = useState(queryKey)
  if (queryKey !== prevQueryKey) {
    setPrevQueryKey(queryKey)
    setLoading(true)
  }

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  function refresh() {
    setLoading(true)
    fetchEntries()
  }

  function handleModuleChange(value: string) {
    setModuleFilter(value === ALL_MODULES_VALUE ? "" : value)
    setPage(1)
  }

  function handleSearch() {
    setPage(1)
    refresh()
  }

  function handleClearFilters() {
    setModuleFilter("")
    setActionFilter("")
    setDateFrom("")
    setDateTo("")
    setPage(1)
  }

  function actionBadgeVariant(action: string) {
    if (action.includes("delete")) return "destructive" as const
    if (action.includes("create")) return "success" as const
    if (action.includes("update") || action.includes("edit")) return "secondary" as const
    return "outline" as const
  }

  const columns: DataTableColumn<AuditEntry>[] = [
    {
      header: "Timestamp",
      className: "text-muted-foreground text-sm whitespace-nowrap",
      cell: (entry) => format(new Date(entry.createdAt), "dd/MM/yyyy HH:mm:ss"),
    },
    {
      header: "Actor",
      cell: (entry) =>
        entry.actor ? (
          <div>
            <p className="text-foreground text-sm font-medium">
              {entry.actor.firstName} {entry.actor.lastName}
            </p>
            <p className="text-muted-foreground font-mono text-xs">{entry.actor.employeeNo}</p>
          </div>
        ) : (
          <span className="text-muted-foreground text-sm italic">System</span>
        ),
    },
    {
      header: "Action",
      cell: (entry) => <Badge variant={actionBadgeVariant(entry.action)}>{entry.action}</Badge>,
    },
    {
      header: "Module",
      cell: (entry) => (
        <span className="text-muted-foreground bg-muted rounded-sm px-2 py-0.5 text-xs font-medium">
          {entry.module}
        </span>
      ),
    },
    {
      header: "Entity",
      className: "text-muted-foreground text-sm",
      cell: (entry) =>
        entry.entityType ? (
          <span>
            {entry.entityType}
            {entry.entityId && (
              <span className="text-muted-foreground ml-1 font-mono text-xs">
                {entry.entityId.slice(0, 8)}…
              </span>
            )}
          </span>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      header: "IP Address",
      className: "text-muted-foreground font-mono text-sm",
      cell: (entry) => entry.ipAddress ?? <span className="text-muted-foreground">-</span>,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        description="Track all actions performed in the system"
        actions={
          <Button variant="outline" onClick={refresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />

      <div className="bg-card border-border flex flex-wrap gap-3 rounded-sm border p-4">
        <Select value={moduleFilter || ALL_MODULES_VALUE} onValueChange={handleModuleChange}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="All modules" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_MODULES_VALUE}>All modules</SelectItem>
            {MODULES.map((mod) => (
              <SelectItem key={mod} value={mod}>
                {mod.charAt(0).toUpperCase() + mod.slice(1).replace("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative w-full sm:min-w-[180px] sm:flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Filter by action…"
            aria-label="Filter by action"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-9"
          />
        </div>

        <DateField
          value={dateFrom}
          onChange={(v) => {
            setDateFrom(v)
            setPage(1)
          }}
          placeholder="From date"
          className="w-full sm:w-40"
        />

        <DateField
          value={dateTo}
          onChange={(v) => {
            setDateTo(v)
            setPage(1)
          }}
          placeholder="To date"
          className="w-full sm:w-40"
        />

        {(moduleFilter || actionFilter || dateFrom || dateTo) && (
          <Button variant="ghost" onClick={handleClearFilters}>
            Clear filters
          </Button>
        )}
      </div>

      {/* Placeheld so the table doesn't jump when the counts arrive. */}
      {loading ? (
        <Skeleton className="h-5 w-56" />
      ) : (
        <p className="text-muted-foreground text-sm">
          Showing {entries.length} of {pagination.total} entries
          {pagination.totalPages > 1 && ` - Page ${pagination.page} of ${pagination.totalPages}`}
        </p>
      )}

      {loading || entries.length > 0 ? (
        <DataTable
          columns={columns}
          rows={entries}
          rowKey={(entry) => entry.id}
          showSerial
          serialOffset={(pagination.page - 1) * pagination.limit}
          loading={loading}
          skeletonRows={10}
          mobileCard={(entry) => (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={actionBadgeVariant(entry.action)}>{entry.action}</Badge>
                <span className="text-muted-foreground bg-muted rounded-sm px-2 py-0.5 text-xs font-medium">
                  {entry.module}
                </span>
              </div>
              {entry.actor ? (
                <p className="text-sm font-medium">
                  {entry.actor.firstName} {entry.actor.lastName}
                  <span className="text-muted-foreground ml-1.5 font-mono text-[11px]">
                    {entry.actor.employeeNo}
                  </span>
                </p>
              ) : (
                <p className="text-muted-foreground text-sm italic">System</p>
              )}
              <p className="text-muted-foreground text-[11px]">
                {format(new Date(entry.createdAt), "dd/MM/yyyy HH:mm:ss")}
                {entry.entityType && (
                  <>
                    {" · "}
                    {entry.entityType}
                    {entry.entityId && ` ${entry.entityId.slice(0, 8)}…`}
                  </>
                )}
                {entry.ipAddress && <> · {entry.ipAddress}</>}
              </p>
            </div>
          )}
          pagination={{
            page: pagination.page,
            totalPages: pagination.totalPages,
            total: pagination.total,
            onPageChange: setPage,
            itemLabel: "record",
          }}
        />
      ) : (
        <EmptyState variant="card" title="No audit log entries found." />
      )}
    </div>
  )
}
