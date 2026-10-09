"use client"

import { useState } from "react"
import { Plus, Building2, Eye, Pencil, FolderKanban, Users, Activity } from "lucide-react"

import { Link } from "@/components/tenant-link"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/page-header"
import { StatStrip } from "@/components/shared/stat-strip"
import { StatusBadge } from "@/components/shared/status-badge"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { EmptyState } from "@/components/shared/empty-state"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { TableSearch } from "@/components/shared/table-search"
import { TableViewMenu } from "@/components/shared/table-view-menu"
import { useDebounce } from "@/hooks/use-debounce"
import { useUrlPage, useUrlState } from "@/hooks/use-url-state"
import { useUpdateEffect } from "@/hooks/use-update-effect"
import { usePermissions } from "@/features/admin/hooks/use-permissions"
import { PERMISSIONS, CLIENT_STATUS_LABELS, CLIENT_STATUS_COLORS } from "@/lib/constants"
import { formatRelativeTime } from "@/lib/utils"
import { useClients, type ClientListItem } from "../hooks/use-clients"
import { clientHref } from "../lib/client-href"
import { ClientFormDialog } from "./client-form-dialog"

const PAGE_SIZE = 20

/** The client book: every client company, its workload and portal usage. */
export function ClientsDirectory() {
  const { can } = usePermissions()
  const canWrite = can(PERMISSIONS.CLIENT_WRITE)

  const [query, setQuery] = useState("")
  // Debounced: every keystroke would otherwise be a server request.
  const search = useDebounce(query.trim())
  const [status, setStatus] = useUrlState("status", "")
  const [page, setPage] = useUrlPage()
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<ClientListItem | null>(null)

  const { data, isLoading } = useClients({
    search: search || undefined,
    status: status || undefined,
    page,
    limit: PAGE_SIZE,
  })
  const clients = data?.data ?? []
  const pagination = data?.pagination
  const summary = data?.summary

  // A new search or filter resets to page 1 (skipped on mount so a deep-linked ?page=N survives).
  useUpdateEffect(() => {
    setPage(1)
  }, [search, status])

  const hasFilters = !!query || !!status

  const columns: DataTableColumn<ClientListItem>[] = [
    {
      header: "Client",
      exportValue: (c) => c.name,
      cell: (c) => (
        <div className="flex items-center gap-2.5">
          <span className="bg-muted flex h-7 w-7 shrink-0 items-center justify-center rounded-sm">
            <Building2 className="text-muted-foreground h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <Link href={clientHref(c)} className="block truncate font-medium hover:underline">
              {c.name}
            </Link>
            <p className="text-muted-foreground truncate font-mono text-[11px]">
              {c.code}
              {c.industry ? ` · ${c.industry}` : ""}
            </p>
          </div>
        </div>
      ),
    },
    {
      header: "Code",
      defaultHidden: true,
      className: "font-mono text-xs",
      exportValue: (c) => c.code,
      cell: (c) => c.code,
    },
    {
      header: "Status",
      exportValue: (c) => CLIENT_STATUS_LABELS[c.status] ?? c.status,
      cell: (c) => (
        <StatusBadge
          status={c.status}
          colorMap={CLIENT_STATUS_COLORS}
          labelMap={CLIENT_STATUS_LABELS}
          size="xs"
        />
      ),
    },
    {
      header: "Account Manager",
      exportValue: (c) => (c.owner ? `${c.owner.firstName} ${c.owner.lastName}` : ""),
      cell: (c) =>
        c.owner ? (
          <div className="flex items-center gap-1.5">
            <AvatarDisplay
              src={c.owner.profilePhoto}
              firstName={c.owner.firstName}
              lastName={c.owner.lastName}
              size="xs"
            />
            <span className="text-xs">
              {c.owner.firstName} {c.owner.lastName}
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        ),
    },
    {
      header: "Projects",
      align: "center",
      exportValue: (c) => c.stats.projects,
      cell: (c) => (
        <span className="text-xs tabular-nums">
          {c.stats.projects}
          {c.stats.projects > 0 && (
            <span className="text-muted-foreground"> · {c.stats.activeProjects} active</span>
          )}
        </span>
      ),
    },
    {
      header: "Contacts",
      align: "center",
      exportValue: (c) => c.stats.contacts,
      cell: (c) => (
        <span className="text-xs tabular-nums">
          {c.stats.contacts}
          {c.stats.contacts > c.stats.activeContacts && (
            <span className="text-muted-foreground">
              {" "}
              · {c.stats.contacts - c.stats.activeContacts} disabled
            </span>
          )}
        </span>
      ),
    },
    {
      header: "Last portal login",
      className: "text-muted-foreground text-xs",
      exportValue: (c) => c.stats.lastLoginAt?.slice(0, 10) ?? "Never",
      cell: (c) => (c.stats.lastLoginAt ? formatRelativeTime(c.stats.lastLoginAt) : "Never"),
    },
    {
      header: "Actions",
      align: "right",
      cell: (c) => (
        <div className="flex items-center justify-end gap-0.5">
          <Button variant="ghost" size="icon" asChild title="Open">
            <Link href={clientHref(c)} aria-label={`Open ${c.name}`}>
              <Eye className="h-4 w-4" />
            </Link>
          </Button>
          {canWrite && (
            <Button
              variant="ghost"
              size="icon"
              title="Edit"
              aria-label={`Edit ${c.name}`}
              onClick={() => setEditing(c)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description="The companies your projects are delivered for, their projects and portal contacts."
        actions={
          canWrite ? (
            <Button className="gap-2" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> New Client
            </Button>
          ) : undefined
        }
      />

      <StatStrip
        loading={isLoading && !summary}
        items={[
          { label: "Clients", value: summary?.clients ?? 0, icon: Building2 },
          {
            label: "Active",
            value: summary?.activeClients ?? 0,
            icon: Activity,
            tone: "success",
          },
          { label: "Client projects", value: summary?.projects ?? 0, icon: FolderKanban },
          { label: "Portal contacts", value: summary?.contacts ?? 0, icon: Users },
        ]}
      />

      {isLoading || clients.length > 0 || hasFilters ? (
        <DataTable
          tableId="clients"
          exportName="clients"
          columns={columns}
          rows={clients}
          rowKey={(c) => c.id}
          showSerial
          serialOffset={(page - 1) * PAGE_SIZE}
          loading={isLoading}
          minWidth="min-w-[920px]"
          toolbar={
            <>
              <TableViewMenu
                label="Status"
                value={status || "ALL"}
                options={[
                  { value: "ALL", label: "All" },
                  ...Object.entries(CLIENT_STATUS_LABELS).map(([value, label]) => ({
                    value,
                    label,
                  })),
                ]}
                onChange={(v) => setStatus(v === "ALL" ? "" : v)}
              />
              <TableSearch
                value={query}
                onChange={setQuery}
                placeholder="Search by name, code, email or website"
                label="Search clients by name, code, email or website"
                className="sm:max-w-sm"
              />
            </>
          }
          pagination={
            pagination
              ? {
                  page: pagination.page,
                  totalPages: pagination.totalPages,
                  total: pagination.total,
                  onPageChange: setPage,
                  itemLabel: "client",
                  pageSize: PAGE_SIZE,
                }
              : undefined
          }
          empty="No clients match. Try a different name, or clear the filters."
        />
      ) : (
        <EmptyState
          variant="card"
          icon={Building2}
          title="No clients yet."
          description="Add the companies you deliver projects for. Each project can then be filed under its client, and the client's people given portal access."
          action={
            canWrite ? { label: "Add First Client", onClick: () => setCreateOpen(true) } : undefined
          }
        />
      )}

      <ClientFormDialog open={createOpen} onClose={() => setCreateOpen(false)} mode="create" />
      {editing && (
        <ClientFormDialog
          open={!!editing}
          onClose={() => setEditing(null)}
          mode="edit"
          clientId={editing.id}
          ownerLabel={
            editing.owner ? `${editing.owner.firstName} ${editing.owner.lastName}` : undefined
          }
          initial={{
            name: editing.name,
            status: editing.status,
            industry: editing.industry ?? "",
            website: editing.website ?? "",
            email: editing.email ?? "",
            phone: editing.phone ?? "",
            ownerId: editing.ownerId ?? "",
          }}
        />
      )}
    </div>
  )
}
