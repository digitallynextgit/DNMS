"use client"

/**
 * /admin/audit-log – Audit Log page.
 *
 * Displays a paginated, filterable table of all audit log entries.
 * Filters: date range (from / to) + module selector.
 *
 * Requires AUDIT_READ permission (enforced by the API and the middleware;
 * the page itself just fetches and renders).
 */

import { useEffect, useState, useCallback } from "react"
import { toast } from "sonner"
import { Loader2, Search, RefreshCw } from "lucide-react"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { MODULES } from "@/lib/constants"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------
export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })
  const [loading, setLoading] = useState(true)

  // Filters
  const [moduleFilter, setModuleFilter] = useState<string>("")
  const [actionFilter, setActionFilter] = useState<string>("")
  const [dateFrom, setDateFrom] = useState<string>("")
  const [dateTo, setDateTo] = useState<string>("")
  const [page, setPage] = useState(1)

  // -----------------------------------------------------------------------
  // Fetch entries
  // -----------------------------------------------------------------------
  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("page", String(page))
      params.set("limit", "20")
      if (moduleFilter) params.set("module", moduleFilter)
      if (actionFilter) params.set("action", actionFilter)
      if (dateFrom) params.set("dateFrom", dateFrom)
      if (dateTo) params.set("dateTo", dateTo)

      const res = await fetch(`/api/audit-log?${params.toString()}`)
      if (!res.ok) throw new Error("Failed to fetch audit log")
      const json = await res.json()
      setEntries(json.data)
      setPagination(json.pagination)
    } catch {
      toast.error("Could not load audit log")
    } finally {
      setLoading(false)
    }
  }, [page, moduleFilter, actionFilter, dateFrom, dateTo])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  // -----------------------------------------------------------------------
  // Filter handlers
  // -----------------------------------------------------------------------
  function handleModuleChange(value: string) {
    setModuleFilter(value === ALL_MODULES_VALUE ? "" : value)
    setPage(1)
  }

  function handleSearch() {
    setPage(1)
    fetchEntries()
  }

  function handleClearFilters() {
    setModuleFilter("")
    setActionFilter("")
    setDateFrom("")
    setDateTo("")
    setPage(1)
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------
  function actionBadgeVariant(action: string) {
    if (action.includes("delete")) return "destructive" as const
    if (action.includes("create")) return "success" as const
    if (action.includes("update") || action.includes("edit")) return "secondary" as const
    return "outline" as const
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-semibold">Audit Log</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Track all actions performed in the system
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={fetchEntries}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Filters row */}
      <div className="bg-card border-border flex flex-wrap gap-3 rounded border p-4">
        {/* Module filter */}
        <Select value={moduleFilter || ALL_MODULES_VALUE} onValueChange={handleModuleChange}>
          <SelectTrigger className="w-40">
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

        {/* Action search */}
        <div className="relative min-w-[180px] flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Filter by action…"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-9"
          />
        </div>

        {/* Date from */}
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => {
            setDateFrom(e.target.value)
            setPage(1)
          }}
          className="w-40"
          aria-label="Date from"
        />

        {/* Date to */}
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => {
            setDateTo(e.target.value)
            setPage(1)
          }}
          className="w-40"
          aria-label="Date to"
        />

        {/* Clear filters */}
        {(moduleFilter || actionFilter || dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" onClick={handleClearFilters}>
            Clear filters
          </Button>
        )}
      </div>

      {/* Summary */}
      {!loading && (
        <p className="text-muted-foreground text-sm">
          Showing {entries.length} of {pagination.total} entries
          {pagination.totalPages > 1 && ` - Page ${pagination.page} of ${pagination.totalPages}`}
        </p>
      )}

      {/* Table */}
      <div className="border-border bg-card overflow-hidden rounded border">
        {loading ? (
          <div className="text-muted-foreground flex items-center justify-center py-20">
            <Loader2 className="mr-2 h-6 w-6 animate-spin" />
            Loading…
          </div>
        ) : entries.length === 0 ? (
          <div className="text-muted-foreground py-20 text-center">No audit log entries found.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Timestamp</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>IP Address</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  {/* Timestamp */}
                  <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                    {format(new Date(entry.createdAt), "dd/MM/yyyy HH:mm:ss")}
                  </TableCell>

                  {/* Actor */}
                  <TableCell>
                    {entry.actor ? (
                      <div>
                        <p className="text-foreground text-sm font-medium">
                          {entry.actor.firstName} {entry.actor.lastName}
                        </p>
                        <p className="text-muted-foreground font-mono text-xs">
                          {entry.actor.employeeNo}
                        </p>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm italic">System</span>
                    )}
                  </TableCell>

                  {/* Action */}
                  <TableCell>
                    <Badge variant={actionBadgeVariant(entry.action)}>{entry.action}</Badge>
                  </TableCell>

                  {/* Module */}
                  <TableCell>
                    <span className="text-muted-foreground bg-muted rounded px-2 py-0.5 text-xs font-medium">
                      {entry.module}
                    </span>
                  </TableCell>

                  {/* Entity */}
                  <TableCell className="text-muted-foreground text-sm">
                    {entry.entityType ? (
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
                    )}
                  </TableCell>

                  {/* IP Address */}
                  <TableCell className="text-muted-foreground font-mono text-sm">
                    {entry.ipAddress ?? <span className="text-muted-foreground">-</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>

          <span className="text-muted-foreground text-sm">
            Page {pagination.page} of {pagination.totalPages}
          </span>

          <Button
            variant="outline"
            size="sm"
            disabled={page >= pagination.totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
