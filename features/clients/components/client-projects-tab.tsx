"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Plus, FolderKanban, Eye } from "lucide-react"

import { Link } from "@/components/tenant-link"
import { Button } from "@/components/ui/button"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { StatusBadge } from "@/components/shared/status-badge"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { EmptyState } from "@/components/shared/empty-state"
import { usePermissions } from "@/features/admin/hooks/use-permissions"
import {
  PERMISSIONS,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_COLORS,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_COLORS,
} from "@/lib/constants"
import { formatDate } from "@/lib/utils"
// Concrete modules rather than the projects barrel: the barrel would land every
// project tab in this page's bundle, which is the thing dynamic() there avoids.
import { ProjectFormDialog } from "@/features/projects/components/project-form-dialog"
import { ProjectLogo } from "@/features/projects/components/project-logo"
import { projectHref } from "@/features/projects/lib/project-href"
import { clientKeys, type ClientProject, type ClientRecord } from "../hooks/use-clients"

/**
 * The client's projects, and the place to start a new one for them. The form
 * opens with the client already chosen, so "new project for Acme" is one click
 * from Acme's page rather than a trip through the projects board.
 */
export function ClientProjectsTab({ client }: { client: ClientRecord }) {
  const { can } = usePermissions()
  const canCreate = can(PERMISSIONS.PROJECT_WRITE)
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)

  const columns: DataTableColumn<ClientProject>[] = [
    { header: "Code", className: "font-mono text-xs", cell: (p) => p.code },
    {
      header: "Project",
      cell: (p) => (
        <div className="flex items-center gap-2">
          <ProjectLogo src={p.logo} name={p.name} className="h-6 w-6" />
          <Link href={projectHref(p)} className="font-medium hover:underline">
            {p.name}
          </Link>
        </div>
      ),
    },
    {
      header: "Status",
      cell: (p) => (
        <StatusBadge
          status={p.status}
          colorMap={PROJECT_STATUS_COLORS}
          labelMap={PROJECT_STATUS_LABELS}
          size="xs"
        />
      ),
    },
    {
      header: "Priority",
      cell: (p) => (
        <StatusBadge
          status={p.priority}
          colorMap={TASK_PRIORITY_COLORS}
          labelMap={TASK_PRIORITY_LABELS}
          size="xs"
        />
      ),
    },
    {
      header: "Account Manager",
      cell: (p) => (
        <div className="flex items-center gap-1.5">
          <AvatarDisplay
            src={p.owner.profilePhoto}
            firstName={p.owner.firstName}
            lastName={p.owner.lastName}
            size="xs"
          />
          <span className="text-xs">
            {p.owner.firstName} {p.owner.lastName}
          </span>
        </div>
      ),
    },
    {
      header: "Tasks",
      align: "center",
      className: "text-muted-foreground tabular-nums",
      cell: (p) => p._count.tasks,
    },
    {
      header: "Onboarded",
      className: "text-muted-foreground text-xs",
      cell: (p) => (p.startDate ? formatDate(p.startDate) : "-"),
    },
    {
      header: "Actions",
      align: "right",
      cell: (p) => (
        <Button variant="ghost" size="icon-sm" asChild title="Open">
          <Link href={projectHref(p)} aria-label={`Open ${p.name}`}>
            <Eye className="h-4 w-4" />
          </Link>
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs">
          {client.projects.length === 0
            ? "Nothing filed under this client yet."
            : `${client.projects.length} project${client.projects.length === 1 ? "" : "s"}, ${client.stats.activeProjects} active.`}
        </p>
        {canCreate && (
          <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            New project
          </Button>
        )}
      </div>

      {client.projects.length === 0 ? (
        <EmptyState
          variant="card"
          icon={FolderKanban}
          title="No projects yet"
          description="Each website, campaign or retainer is its own project under this client."
          action={
            canCreate ? { label: "New project", onClick: () => setCreateOpen(true) } : undefined
          }
        />
      ) : (
        <DataTable
          columns={columns}
          rows={client.projects}
          rowKey={(p) => p.id}
          showSerial
          minWidth="min-w-[900px]"
        />
      )}

      <ProjectFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        mode="create"
        initial={{ clientId: client.id, clientName: client.name }}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: clientKeys.detail(client.slug || client.id) })
          qc.invalidateQueries({ queryKey: clientKeys.detail(client.id) })
        }}
      />
    </div>
  )
}
