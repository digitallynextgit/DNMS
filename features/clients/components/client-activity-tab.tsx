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

/** The client's portal activity across all projects (client_activity_logs, separate from the
 *  staff audit log). */
export function ClientActivityTab({ clientRef }: { clientRef: string }) {
  const [page, setPage] = useState(1)
  const { data, isLoading } = useClientActivity(clientRef, page)
  const rows = data?.data ?? []
  const pagination = data?.pagination

  const columns: DataTableColumn<ClientActivityEvent>[] = [
    {
      header: "When",
      className: "text-muted-foreground text-xs",
      exportValue: (e) => formatDateTime(e.createdAt),
      cell: (e) => formatDateTime(e.createdAt),
    },
    {
      header: "Who",
      exportValue: (e) => e.clientUser.name,
      cell: (e) => (
        <div className="max-w-[220px] min-w-0">
          <p className="truncate text-xs font-medium">{e.clientUser.name}</p>
          <p className="text-muted-foreground truncate text-[11px]" title={e.clientUser.email}>
            {e.clientUser.email}
          </p>
        </div>
      ),
    },
    {
      header: "What",
      className: "max-w-[280px] truncate",
      exportValue: (e) => e.summary ?? fallbackLabel(e.action),
      cell: (e) => {
        const what = e.summary ?? fallbackLabel(e.action)
        return (
          <span className="text-xs" title={what}>
            {what}
          </span>
        )
      },
    },
    {
      header: "Project",
      exportValue: (e) => e.project?.name ?? "",
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
      exportValue: (e) => e.module,
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
      tableId="client-activity"
      exportName="client-activity"
      columns={columns}
      rows={rows}
      rowKey={(e) => e.id}
      loading={isLoading}
      showSerial
      serialOffset={pagination ? (pagination.page - 1) * pagination.limit : 0}
      minWidth="min-w-[760px]"
      pagination={
        pagination
          ? {
              page: pagination.page,
              totalPages: pagination.totalPages,
              total: pagination.total,
              onPageChange: setPage,
              itemLabel: "event",
              pageSize: pagination.limit,
            }
          : undefined
      }
    />
  )
}
