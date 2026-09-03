"use client"

import { useState } from "react"
import { Activity } from "lucide-react"

import { Link } from "@/components/tenant-link"
import { Badge } from "@/components/ui/badge"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { EmptyState } from "@/components/shared/empty-state"
import { formatDateTime } from "@/lib/utils"
import { useClientActivity, type ClientActivityEvent } from "../hooks/use-clients"

/** Last-resort label when a row predates summaries: "campaign:queue" → "Campaign queue". */
function fallbackLabel(action: string): string {
  const words = action.replace(/[:_]/g, " ").trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/**
 * What this client's people have done in the portal, across all of their
 * projects. Reads client_activity_logs, which is separate from the staff audit
 * log by design: nothing here can surface an employee's actions.
 */
export function ClientActivityTab({ clientRef }: { clientRef: string }) {
  const [page, setPage] = useState(1)
  const { data, isLoading } = useClientActivity(clientRef, page)
  const rows = data?.data ?? []
  const pagination = data?.pagination

  const columns: DataTableColumn<ClientActivityEvent>[] = [
    {
      header: "When",
      className: "text-muted-foreground text-xs whitespace-nowrap",
      cell: (e) => formatDateTime(e.createdAt),
    },
    {
      header: "Who",
      cell: (e) => (
        <div className="min-w-0">
          <p className="truncate text-xs font-medium">{e.clientUser.name}</p>
          <p className="text-muted-foreground truncate text-[11px]">{e.clientUser.email}</p>
        </div>
      ),
    },
    {
      header: "What",
      cell: (e) => <span className="text-xs">{e.summary ?? fallbackLabel(e.action)}</span>,
    },
    {
      header: "Project",
      cell: (e) =>
        e.project ? (
          <Link
            href={`/projects/${e.project.slug || e.project.id}`}
            className="text-xs hover:underline"
          >
            {e.project.name}
          </Link>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        ),
    },
    {
      header: "Section",
      cell: (e) => (
        <Badge variant="outline" className="text-[10px] capitalize">
          {e.module}
        </Badge>
      ),
    },
  ]

  if (!isLoading && rows.length === 0 && page === 1) {
    return (
      <EmptyState
        variant="card"
        icon={Activity}
        title="No portal activity yet"
        description="Once someone at this client signs in and does something, it shows up here."
      />
    )
  }

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(e) => e.id}
      loading={isLoading}
      minWidth="min-w-[760px]"
      pagination={
        pagination
          ? {
              page: pagination.page,
              totalPages: pagination.totalPages,
              total: pagination.total,
              onPageChange: setPage,
              itemLabel: "event",
            }
          : undefined
      }
    />
  )
}
