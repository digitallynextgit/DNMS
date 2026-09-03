"use client"

import { useEffect, useMemo, useState } from "react"
import { useUrlPage } from "@/hooks/use-url-state"
import { useUpdateEffect } from "@/hooks/use-update-effect"
import { Link } from "@/components/tenant-link"
import { useQuery } from "@tanstack/react-query"
import { Plus, FolderKanban, Calendar, Users, MoreHorizontal, Eye, Pencil } from "lucide-react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/page-header"
import { Pagination } from "@/components/shared/pagination"
import { StatusBadge } from "@/components/shared/status-badge"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { EmptyState } from "@/components/shared/empty-state"
import { CardGridSkeleton } from "@/components/shared/loading-skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { usePermissions } from "@/features/admin/hooks/use-permissions"
import { PERMISSIONS, PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS } from "@/lib/constants"
import { formatDate } from "@/lib/utils"
import { ProjectFormDialog, ProjectLogo, projectHref } from "@/features/projects"
// The leaf helper, not the clients barrel: the barrel would land the whole
// client book (and the portal feature behind it) in the projects board bundle.
import { clientHref } from "@/features/clients/lib/client-href"
import { ViewToggle, useViewMode } from "@/components/shared/view-toggle"

interface Project {
  id: string
  name: string
  code: string
  slug: string | null
  description: string | null
  /** Stable route URL for the logo; null when none has been uploaded. */
  logo: string | null
  status: string
  priority: string
  startDate: string | null
  endDate: string | null
  budget: number | null
  owner: { id: string; firstName: string; lastName: string; profilePhoto: string | null }
  /** The company this is delivered for. Null for internal projects. */
  client: { id: string; name: string; slug: string | null } | null
  members: {
    employee: { id: string; firstName: string; lastName: string; profilePhoto: string | null }
  }[]
  _count: { tasks: number; teams?: number; resources?: number }
}

const PAGE_SIZE = 10

/** Status groups, in the order they are stacked down the page. */
const STATUS_ORDER = ["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED"] as const

async function fetchProjects(): Promise<{ data: Project[] }> {
  const res = await fetch("/api/projects?limit=100")
  if (!res.ok) throw new Error("Failed to fetch projects")
  return res.json()
}

export function ProjectsClient() {
  const { can } = usePermissions()
  const canWrite = can(PERMISSIONS.PROJECT_WRITE)
  const { data: session } = useSession()
  const userId = session?.user?.id ?? ""

  const { data, isLoading } = useQuery({ queryKey: ["projects"], queryFn: fetchProjects })
  const projects = data?.data ?? []

  // A project's ACCOUNT MANAGER (owner) can do anything on their own project,
  // just like an admin - even without the global project:write permission.
  const canManageProject = (p: Project) => canWrite || p.owner.id === userId
  const showBudget = canWrite || projects.some((p) => p.owner.id === userId)

  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  // This page is card/table only. The board view was removed, but a stored
  // preference from when it existed would otherwise restore a mode that no
  // longer renders, so it falls back to cards.
  const [storedView, setViewMode] = useViewMode("projects:list")
  const viewMode = storedView === "kanban" ? "card" : storedView
  const [page, setPage] = useUrlPage()

  const total = projects.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Reset to page 1 when switching views. Skips mount so a deep-linked ?page=N
  // isn't clobbered on first render.
  useUpdateEffect(() => {
    setPage(1)
  }, [viewMode])

  // Clamp the page if the list shrinks below the current page.
  useEffect(() => {
    if (!isLoading && page > totalPages) setPage(totalPages)
  }, [page, totalPages, isLoading])

  // Current page of projects (flat slice), then regrouped by status for the
  // card/table section rendering.
  const pageProjects = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return projects.slice(start, start + PAGE_SIZE)
  }, [projects, page])

  // Status grouping for the card / table views - current page only.
  const pageStatusGroups = STATUS_ORDER.map(
    (status) => [status, pageProjects.filter((p) => p.status === status)] as const,
  )

  // Table view uses the shared DataTable (S.No, house styling, scroll handling).
  // One table per status group, so the S.No restarts within each group.
  const tableColumns: DataTableColumn<Project>[] = [
    { header: "Code", className: "font-mono text-xs", cell: (p) => p.code },
    {
      header: "Name",
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
      header: "Client",
      cell: (p) =>
        p.client ? (
          <Link href={clientHref(p.client)} className="text-xs hover:underline">
            {p.client.name}
          </Link>
        ) : (
          <span className="text-muted-foreground text-xs">Internal</span>
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
      className: "text-muted-foreground",
      cell: (p) => p._count.tasks,
    },
    {
      header: "Members",
      align: "center",
      className: "text-muted-foreground",
      cell: (p) => p.members.length,
    },
    ...(showBudget
      ? [
          {
            header: "Budget",
            align: "right" as const,
            className: "text-xs",
            cell: (p: Project) =>
              canManageProject(p) && p.budget != null ? (
                `₹${p.budget.toLocaleString("en-IN")}`
              ) : (
                <span className="text-muted-foreground">-</span>
              ),
          },
        ]
      : []),
    {
      header: "Actions",
      align: "right",
      cell: (p) => (
        <div className="flex items-center justify-end gap-0.5">
          <Button variant="ghost" size="icon-sm" asChild title="View details">
            <Link href={projectHref(p)} aria-label={`View ${p.name}`}>
              <Eye className="h-4 w-4" />
            </Link>
          </Button>
          {canManageProject(p) && (
            <Button
              variant="ghost"
              size="icon-sm"
              title="Edit"
              aria-label={`Edit ${p.name}`}
              onClick={() => setEditing(p)}
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
        title="Projects"
        description="Manage projects, teams, tasks, and resources."
        actions={
          <div className="flex items-center gap-2">
            <ViewToggle value={viewMode} onChange={setViewMode} />
            {canWrite && (
              <Button onClick={() => setCreateOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" /> New Project
              </Button>
            )}
          </div>
        }
      />

      {isLoading ? (
        <CardGridSkeleton />
      ) : projects.length === 0 ? (
        <EmptyState
          variant="card"
          icon={FolderKanban}
          title="No projects yet."
          action={
            canWrite
              ? { label: "Create First Project", onClick: () => setCreateOpen(true) }
              : undefined
          }
        />
      ) : (
        /* ── Card / Table views ── */
        <div className="space-y-6">
          {pageStatusGroups.map(([status, group]) =>
            group.length === 0 ? null : (
              <div key={status}>
                <div className="mb-3 flex items-center gap-2">
                  <StatusBadge
                    status={status}
                    colorMap={PROJECT_STATUS_COLORS}
                    labelMap={PROJECT_STATUS_LABELS}
                    size="button"
                  />
                  <span className="text-muted-foreground text-xs">
                    {group.length} project{group.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {viewMode === "table" ? (
                  <DataTable
                    columns={tableColumns}
                    rows={group}
                    rowKey={(p) => p.id}
                    showSerial
                    minWidth="min-w-[860px]"
                  />
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {group.map((project) => (
                      <div
                        key={project.id}
                        className="group bg-card hover:border-foreground/20 hover:bg-muted/30 relative flex flex-col gap-3 rounded-[2px] border p-4 transition-colors"
                      >
                        {/* Stretched link: an absolutely-positioned overlay makes the
                            WHOLE card clickable while keeping the markup valid (an
                            <a> may not wrap buttons). Anything interactive on the
                            card sits above it with `relative z-10`. */}
                        <Link
                          href={projectHref(project)}
                          aria-label={`Open ${project.name}`}
                          className="focus-visible:ring-ring absolute inset-0 rounded-[2px] focus-visible:ring-2 focus-visible:outline-none"
                        />
                        <div className="flex items-start justify-between gap-2">
                          <ProjectLogo
                            src={project.logo}
                            name={project.name}
                            className="h-10 w-10"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-1 text-sm font-medium group-hover:underline">
                              {project.name}
                            </p>
                            <p className="text-muted-foreground mt-0.5 font-mono text-xs">
                              {project.code}
                            </p>
                            {project.client && (
                              <p className="text-muted-foreground mt-0.5 truncate text-xs">
                                for{" "}
                                <Link
                                  href={clientHref(project.client)}
                                  className="relative z-10 hover:underline"
                                >
                                  {project.client.name}
                                </Link>
                              </p>
                            )}
                          </div>
                          {canWrite && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="relative z-10 shrink-0"
                                  aria-label="More actions"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="z-20">
                                <DropdownMenuItem asChild>
                                  <Link href={projectHref(project)}>View Details</Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setEditing(project)}>
                                  Edit
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>

                        {project.description && (
                          <p className="text-muted-foreground line-clamp-2 text-xs">
                            {project.description}
                          </p>
                        )}

                        <div className="flex items-center gap-2 text-xs">
                          <AvatarDisplay
                            src={project.owner.profilePhoto}
                            firstName={project.owner.firstName}
                            lastName={project.owner.lastName}
                            size="xs"
                          />
                          <span className="text-muted-foreground">Account Manager:</span>
                          <span className="font-medium">
                            {project.owner.firstName} {project.owner.lastName}
                          </span>
                        </div>

                        <div className="text-muted-foreground flex items-center gap-3 text-xs">
                          <span className="flex items-center gap-1">
                            <FolderKanban className="h-3 w-3" />
                            {project._count.tasks} tasks
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {project.members.length} members
                          </span>
                          {project.endDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(project.endDate)}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          {project.members.slice(0, 5).map((m) => (
                            <AvatarDisplay
                              key={m.employee.id}
                              src={m.employee.profilePhoto}
                              firstName={m.employee.firstName}
                              lastName={m.employee.lastName}
                              size="chip"
                              className="border-background -ml-1 border-2 first:ml-0"
                            />
                          ))}
                          {project.members.length > 5 && (
                            <span className="text-muted-foreground ml-1 text-xs">
                              +{project.members.length - 5}
                            </span>
                          )}
                        </div>

                        {canWrite && project.budget !== null && (
                          <div className="text-muted-foreground text-[11px]">
                            Budget:{" "}
                            <span className="text-foreground font-medium">
                              ₹{project.budget.toLocaleString("en-IN")}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ),
          )}
        </div>
      )}

      {!isLoading && total > 0 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          onPageChange={setPage}
          itemLabel="project"
        />
      )}

      <ProjectFormDialog open={createOpen} onClose={() => setCreateOpen(false)} mode="create" />
      {editing && (
        <ProjectFormDialog
          open={!!editing}
          onClose={() => setEditing(null)}
          mode="edit"
          projectId={editing.id}
          logo={editing.logo}
          initial={{
            name: editing.name,
            code: editing.code,
            description: editing.description ?? "",
            status: editing.status,
            priority: editing.priority,
            startDate: editing.startDate ? editing.startDate.split("T")[0] : "",
            budget: editing.budget != null ? String(editing.budget) : "",
            accountManagerId: editing.owner.id,
            clientId: editing.client?.id ?? "",
            clientName: editing.client?.name,
          }}
        />
      )}
    </div>
  )
}
