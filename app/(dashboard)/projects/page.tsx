"use client"

import { useEffect, useMemo, useState, type CSSProperties } from "react"
import { useUrlPage } from "@/hooks/use-url-state"
import Link from "next/link"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd"
import { toast } from "sonner"
import { Plus, FolderKanban, Calendar, Users, MoreHorizontal, GripVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/page-header"
import { Pagination } from "@/components/shared/pagination"
import { StatusBadge } from "@/components/shared/status-badge"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { EmptyState } from "@/components/shared/empty-state"
import { CardGridSkeleton } from "@/components/shared/loading-skeleton"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { usePermissions } from "@/features/admin"
import {
  PERMISSIONS,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_COLORS,
  TASK_PRIORITY_COLORS,
  TASK_PRIORITY_LABELS,
} from "@/lib/constants"
import { formatDate, cn } from "@/lib/utils"
import { ProjectFormDialog } from "@/features/projects"
import { ViewToggle, useViewMode } from "@/components/shared/view-toggle"

interface Project {
  id: string
  name: string
  code: string
  description: string | null
  status: string
  priority: string
  startDate: string | null
  endDate: string | null
  budget: number | null
  owner: { id: string; firstName: string; lastName: string; profilePhoto: string | null }
  members: {
    employee: { id: string; firstName: string; lastName: string; profilePhoto: string | null }
  }[]
  _count: { tasks: number; teams?: number; resources?: number }
}

const KANBAN_COLUMNS: { id: string; color: string }[] = [
  { id: "PLANNING", color: "bg-slate-50 dark:bg-slate-900/40" },
  { id: "ACTIVE", color: "bg-blue-50 dark:bg-blue-950/30" },
  { id: "ON_HOLD", color: "bg-amber-50 dark:bg-amber-950/30" },
  { id: "COMPLETED", color: "bg-emerald-50 dark:bg-emerald-950/30" },
]

const PAGE_SIZE = 10

async function fetchProjects(): Promise<{ data: Project[] }> {
  const res = await fetch("/api/projects?limit=100")
  if (!res.ok) throw new Error("Failed to fetch projects")
  return res.json()
}

async function archiveProject(id: string) {
  const res = await fetch(`/api/projects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isArchived: true }),
  })
  if (!res.ok) throw new Error("Failed to archive project")
  return res.json()
}

async function updateProjectStatus(id: string, status: string) {
  const res = await fetch(`/api/projects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  })
  if (!res.ok) throw new Error("Failed to update status")
  return res.json()
}

export default function ProjectsPage() {
  const { can } = usePermissions()
  const canWrite = can(PERMISSIONS.PROJECT_WRITE)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({ queryKey: ["projects"], queryFn: fetchProjects })
  const projects = data?.data ?? []

  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<Project | null>(null)
  const [viewMode, setViewMode] = useViewMode("projects:list")
  const [page, setPage] = useUrlPage()

  // Client-side pagination applies only to the flat list (card/table) views.
  // The kanban board groups by status and is intentionally left unpaginated.
  const isPaginated = viewMode !== "kanban"
  const total = projects.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Reset to page 1 when switching views or when the project list changes size.
  useEffect(() => {
    setPage(1)
  }, [viewMode])

  // Clamp the page if the list shrinks below the current page.
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  // Current page of projects (flat slice), then regrouped by status for the
  // card/table section rendering.
  const pageProjects = useMemo(() => {
    if (!isPaginated) return projects
    const start = (page - 1) * PAGE_SIZE
    return projects.slice(start, start + PAGE_SIZE)
  }, [projects, page, isPaginated])

  const archiveMut = useMutation({
    mutationFn: archiveProject,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] })
      toast.success("Project archived")
    },
    onError: () => toast.error("Failed to archive project"),
  })

  // Full grouping - used by the kanban board (unpaginated).
  const statusGroups: Record<string, Project[]> = {
    PLANNING: projects.filter((p) => p.status === "PLANNING"),
    ACTIVE: projects.filter((p) => p.status === "ACTIVE"),
    ON_HOLD: projects.filter((p) => p.status === "ON_HOLD"),
    COMPLETED: projects.filter((p) => p.status === "COMPLETED"),
  }

  // Paginated grouping - used by the card / table list views (current page only).
  const pageStatusGroups: Record<string, Project[]> = {
    PLANNING: pageProjects.filter((p) => p.status === "PLANNING"),
    ACTIVE: pageProjects.filter((p) => p.status === "ACTIVE"),
    ON_HOLD: pageProjects.filter((p) => p.status === "ON_HOLD"),
    COMPLETED: pageProjects.filter((p) => p.status === "COMPLETED"),
  }

  function onDragEnd(result: DropResult) {
    if (!result.destination) return
    const { draggableId, destination, source } = result
    if (destination.droppableId === source.droppableId) return
    if (!canWrite) return

    const newStatus = destination.droppableId

    // Optimistic update
    qc.setQueryData(["projects"], (old: { data: Project[] } | undefined) => {
      if (!old) return old
      return {
        ...old,
        data: old.data.map((p) => (p.id === draggableId ? { ...p, status: newStatus } : p)),
      }
    })

    updateProjectStatus(draggableId, newStatus)
      .then(() => qc.invalidateQueries({ queryKey: ["projects"] }))
      .catch(() => {
        qc.invalidateQueries({ queryKey: ["projects"] })
        toast.error("Failed to move project")
      })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Manage projects, teams, tasks, and resources."
        actions={
          <div className="flex items-center gap-2">
            <ViewToggle value={viewMode} onChange={setViewMode} showKanban />
            {canWrite && (
              <Button onClick={() => setCreateOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" /> New Project
              </Button>
            )}
          </div>
        }
      />

      {isLoading ? (
        viewMode === "kanban" ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {KANBAN_COLUMNS.map((c) => (
              <div key={c.id} className="space-y-2">
                <Skeleton className="h-5 w-24 rounded" />
                <Skeleton className="h-36 rounded" />
                <Skeleton className="h-36 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <CardGridSkeleton />
        )
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
      ) : viewMode === "kanban" ? (
        /* ── Kanban board ── */
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid grid-cols-2 items-stretch gap-3 lg:grid-cols-4">
            {KANBAN_COLUMNS.map((col) => {
              const group = statusGroups[col.id] ?? []
              return (
                <div key={col.id} className="flex min-w-0 flex-col">
                  <div className="mb-2 flex items-center justify-between px-1">
                    <StatusBadge
                      status={col.id}
                      colorMap={PROJECT_STATUS_COLORS}
                      labelMap={PROJECT_STATUS_LABELS}
                    />
                    <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                      {group.length}
                    </Badge>
                  </div>

                  <Droppable droppableId={col.id} isDropDisabled={!canWrite}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={cn(
                          "min-h-32 flex-1 space-y-2 rounded p-2 transition-colors",
                          col.color,
                          snapshot.isDraggingOver && "ring-primary/40 ring-2",
                        )}
                      >
                        {group.map((project, index) => (
                          <Draggable
                            key={project.id}
                            draggableId={project.id}
                            index={index}
                            isDragDisabled={!canWrite}
                          >
                            {(drag, snap) => (
                              <div
                                ref={drag.innerRef}
                                {...drag.draggableProps}
                                style={drag.draggableProps.style as CSSProperties}
                                className={cn(
                                  "bg-background rounded border p-3 shadow-sm select-none",
                                  snap.isDragging && "ring-primary/50 rotate-1 shadow-lg ring-2",
                                )}
                              >
                                {/* drag handle + menu row */}
                                <div className="mb-2 flex items-start justify-between gap-1">
                                  <div
                                    {...drag.dragHandleProps}
                                    className="mt-0.5 cursor-grab active:cursor-grabbing"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <GripVertical className="text-muted-foreground/40 h-3.5 w-3.5" />
                                  </div>
                                  <div className="-ml-1 min-w-0 flex-1">
                                    <Link
                                      href={`/projects/${project.id}`}
                                      className="line-clamp-2 block text-sm leading-snug font-medium hover:underline"
                                    >
                                      {project.name}
                                    </Link>
                                    <p className="text-muted-foreground mt-0.5 font-mono text-[10px]">
                                      {project.code}
                                    </p>
                                  </div>
                                  {canWrite && (
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="-mr-1 h-6 w-6 shrink-0"
                                        >
                                          <MoreHorizontal className="h-3.5 w-3.5" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem asChild>
                                          <Link href={`/projects/${project.id}`}>View Details</Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setEditing(project)}>
                                          Edit
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          className="text-destructive"
                                          onClick={() => setArchiveTarget(project)}
                                        >
                                          Archive
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  )}
                                </div>

                                {project.description && (
                                  <p className="text-muted-foreground mb-2 line-clamp-2 text-[11px]">
                                    {project.description}
                                  </p>
                                )}

                                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                                  <StatusBadge
                                    status={project.priority}
                                    colorMap={TASK_PRIORITY_COLORS}
                                    labelMap={TASK_PRIORITY_LABELS}
                                    size="xs"
                                    className="py-0"
                                  />
                                  <span className="text-muted-foreground flex items-center gap-0.5 text-[10px]">
                                    <FolderKanban className="h-3 w-3" />
                                    {project._count.tasks}
                                  </span>
                                  <span className="text-muted-foreground flex items-center gap-0.5 text-[10px]">
                                    <Users className="h-3 w-3" />
                                    {project.members.length}
                                  </span>
                                </div>

                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1">
                                    <AvatarDisplay
                                      src={project.owner.profilePhoto}
                                      firstName={project.owner.firstName}
                                      lastName={project.owner.lastName}
                                      size="xs"
                                    />
                                    <span className="text-muted-foreground text-[10px]">
                                      {project.owner.firstName}
                                    </span>
                                  </div>
                                  {project.startDate && (
                                    <span className="text-muted-foreground flex items-center gap-0.5 text-[10px]">
                                      <Calendar className="h-3 w-3" />
                                      {formatDate(project.startDate)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                        {group.length === 0 && !snapshot.isDraggingOver && (
                          <p className="text-muted-foreground/50 py-6 text-center text-[11px]">
                            No projects
                          </p>
                        )}
                      </div>
                    )}
                  </Droppable>
                </div>
              )
            })}
          </div>
        </DragDropContext>
      ) : (
        /* ── Card / Table views ── */
        <div className="space-y-6">
          {Object.entries(pageStatusGroups).map(([status, group]) =>
            group.length === 0 ? null : (
              <div key={status}>
                <div className="mb-3 flex items-center gap-2">
                  <StatusBadge
                    status={status}
                    colorMap={PROJECT_STATUS_COLORS}
                    labelMap={PROJECT_STATUS_LABELS}
                  />
                  <span className="text-muted-foreground text-xs">
                    {group.length} project{group.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {viewMode === "table" ? (
                  <div className="bg-card overflow-x-auto rounded border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 border-border border-b">
                        <tr className="text-muted-foreground text-left text-xs tracking-wider uppercase">
                          <th className="px-4 py-2.5 font-medium">Code</th>
                          <th className="px-4 py-2.5 font-medium">Name</th>
                          <th className="px-4 py-2.5 font-medium">Account Manager</th>
                          <th className="px-4 py-2.5 text-center font-medium">Tasks</th>
                          <th className="px-4 py-2.5 text-center font-medium">Members</th>
                          {canWrite && (
                            <th className="px-4 py-2.5 text-right font-medium">Budget</th>
                          )}
                          <th className="px-4 py-2.5 text-right font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-border divide-y">
                        {group.map((project) => (
                          <tr key={project.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-2.5 font-mono text-xs">{project.code}</td>
                            <td className="px-4 py-2.5">
                              <Link
                                href={`/projects/${project.id}`}
                                className="font-medium hover:underline"
                              >
                                {project.name}
                              </Link>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-1.5">
                                <AvatarDisplay
                                  src={project.owner.profilePhoto}
                                  firstName={project.owner.firstName}
                                  lastName={project.owner.lastName}
                                  size="xs"
                                />
                                <span className="text-xs">
                                  {project.owner.firstName} {project.owner.lastName}
                                </span>
                              </div>
                            </td>
                            <td className="text-muted-foreground px-4 py-2.5 text-center">
                              {project._count.tasks}
                            </td>
                            <td className="text-muted-foreground px-4 py-2.5 text-center">
                              {project.members.length}
                            </td>
                            {canWrite && (
                              <td className="px-4 py-2.5 text-right text-xs">
                                {project.budget != null ? (
                                  `₹${project.budget.toLocaleString("en-IN")}`
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </td>
                            )}
                            <td className="px-4 py-2.5 text-right">
                              {canWrite ? (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem asChild>
                                      <Link href={`/projects/${project.id}`}>View Details</Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setEditing(project)}>
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      onClick={() => setArchiveTarget(project)}
                                    >
                                      Archive
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              ) : (
                                <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
                                  <Link href={`/projects/${project.id}`}>Open</Link>
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {group.map((project) => (
                      <div
                        key={project.id}
                        className="bg-card hover:border-foreground/20 flex flex-col gap-3 rounded border p-4 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/projects/${project.id}`}
                              className="line-clamp-1 text-sm font-medium hover:underline"
                            >
                              {project.name}
                            </Link>
                            <p className="text-muted-foreground mt-0.5 font-mono text-xs">
                              {project.code}
                            </p>
                          </div>
                          {canWrite && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                  <Link href={`/projects/${project.id}`}>View Details</Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setEditing(project)}>
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => setArchiveTarget(project)}
                                >
                                  Archive
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
                              size="xs"
                              className="border-background -ml-1 h-6 w-6 border-2 first:ml-0"
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

      {/* Pagination - card / table list views only (kanban stays unpaginated). */}
      {!isLoading && isPaginated && total > 0 && (
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
          initial={{
            name: editing.name,
            code: editing.code,
            description: editing.description ?? "",
            status: editing.status,
            priority: editing.priority,
            startDate: editing.startDate ? editing.startDate.split("T")[0] : "",
            budget: editing.budget != null ? String(editing.budget) : "",
            accountManagerId: editing.owner.id,
          }}
        />
      )}

      <ConfirmDialog
        open={!!archiveTarget}
        onOpenChange={(o) => !o && setArchiveTarget(null)}
        title="Archive project"
        description={archiveTarget ? `Archive "${archiveTarget.name}"?` : ""}
        confirmLabel="Archive"
        variant="destructive"
        isLoading={archiveMut.isPending}
        onConfirm={() => {
          if (archiveTarget)
            archiveMut.mutate(archiveTarget.id, { onSuccess: () => setArchiveTarget(null) })
        }}
      />
    </div>
  )
}
