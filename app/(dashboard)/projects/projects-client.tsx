"use client"

import { useMemo, useState } from "react"
import { Link } from "@/components/tenant-link"
import { useQuery } from "@tanstack/react-query"
import { Plus, FolderKanban, Eye, Pencil } from "lucide-react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { TableSearch } from "@/components/shared/table-search"
import { TableViewMenu } from "@/components/shared/table-view-menu"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { EmptyState } from "@/components/shared/empty-state"
import { usePermissions } from "@/features/admin/hooks/use-permissions"
import {
  PERMISSIONS,
  PROJECT_STAGE_COLORS,
  PROJECT_STAGE_LABELS,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_COLORS,
} from "@/lib/constants"
import { cn } from "@/lib/utils"
import {
  PROJECT_SERVICES,
  ProjectFormDialog,
  ProjectLogo,
  ProjectServicesDialog,
  ServiceChips,
  projectHref,
  servicesText,
  type ServiceOwner,
} from "@/features/projects"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
// Leaf helper, not the clients barrel: the barrel would pull the whole client book into this bundle.
import { clientHref } from "@/features/clients/lib/client-href"

interface Project {
  id: string
  name: string
  code: string
  shortName: string | null
  services: string[]
  serviceOwners: ServiceOwner[]
  slug: string | null
  description: string | null
  /** Stable route URL for the logo; null when none has been uploaded. */
  logo: string | null
  status: string
  priority: string
  /** Lifecycle "Phase" (LAUNCH…DECLINE), or null when not set. */
  stage: string | null
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

const ALL_SERVICES = "__all__"
const ALL_STATUSES = "ALL"

/** Status groups, top to bottom. CANCELLED must be here or an all-cancelled list renders blank. */
const STATUS_ORDER = ["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"] as const

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
  const [service, setService] = useState(ALL_SERVICES)
  // Once per person, so counts and avatars agree: someone can be on several of a project's teams.
  const allProjects = useMemo(
    () =>
      (data?.data ?? []).map((p) => ({
        ...p,
        services: p.services ?? [],
        serviceOwners: p.serviceOwners ?? [],
        members: [...new Map(p.members.map((m) => [m.employee.id, m])).values()],
      })),
    [data],
  )
  const projects = useMemo(
    () =>
      service === ALL_SERVICES
        ? allProjects
        : allProjects.filter((p) => p.services.includes(service)),
    [allProjects, service],
  )

  // The account manager (owner) can manage their own project even without project:write.
  const canManageProject = (p: Project) => canWrite || p.owner.id === userId
  const showBudget = canWrite || projects.some((p) => p.owner.id === userId)

  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  // By id, so the popup shows fresh owners after a change refetches the list.
  const [servicesOfId, setServicesOfId] = useState<string | null>(null)
  const servicesOf = allProjects.find((p) => p.id === servicesOfId) ?? null

  const servicesButton = (p: Project, className?: string) => (
    <button
      type="button"
      onClick={() => setServicesOfId(p.id)}
      aria-label={`Services of ${p.name}`}
      title="Owners and calendars"
      className={cn(
        "hover:bg-accent/60 focus-visible:ring-ring -m-1 rounded-sm p-1 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none",
        className,
      )}
    >
      <ServiceChips services={p.services} owners={p.serviceOwners} />
    </button>
  )

  // A status view and a search narrow the list further.
  const [status, setStatus] = useState<string>(ALL_STATUSES)
  const [query, setQuery] = useState("")
  const needle = query.trim().toLowerCase()
  const tableProjects = projects.filter(
    (p) =>
      (status === ALL_STATUSES || p.status === status) &&
      (!needle ||
        [p.name, p.code, p.shortName, p.client?.name, `${p.owner.firstName} ${p.owner.lastName}`]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(needle))),
  )
  const statusViews = [
    { value: ALL_STATUSES, label: "All", count: projects.length },
    ...STATUS_ORDER.map((s) => ({
      value: s,
      label: PROJECT_STATUS_LABELS[s] ?? s,
      count: projects.filter((p) => p.status === s).length,
    })),
  ]
  const budgetOf = (p: Project) => (canManageProject(p) && p.budget != null ? p.budget : null)

  const tableColumns: DataTableColumn<Project>[] = [
    {
      header: "Project",
      sortValue: (p) => p.name,
      cell: (p) => (
        <div className="flex items-center gap-2">
          <ProjectLogo src={p.logo} name={p.name} className="h-7 w-7" />
          <div className="min-w-0">
            <Link href={projectHref(p)} className="block font-medium hover:underline">
              {p.name}
            </Link>
            <span className="text-muted-foreground font-mono text-[11px]">{p.code}</span>
          </div>
        </div>
      ),
    },
    {
      header: "Code",
      defaultHidden: true,
      sortValue: (p) => p.code,
      className: "font-mono text-xs",
      cell: (p) => p.code,
    },
    {
      header: "Short name",
      sortValue: (p) => p.shortName,
      cell: (p) =>
        p.shortName ? (
          <span className="font-semibold">{p.shortName}</span>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        ),
    },
    {
      header: "Client",
      sortValue: (p) => p.client?.name ?? "Internal",
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
      header: "Services",
      exportValue: (p) => servicesText(p.services, p.serviceOwners),
      // min-width on the button: table cells ignore it.
      cell: (p) => servicesButton(p, "block min-w-[240px]"),
    },
    {
      header: "Status / Phase",
      sortValue: (p) => STATUS_ORDER.indexOf(p.status as (typeof STATUS_ORDER)[number]),
      exportValue: (p) =>
        [PROJECT_STATUS_LABELS[p.status] ?? p.status, p.stage && PROJECT_STAGE_LABELS[p.stage]]
          .filter(Boolean)
          .join(" · "),
      cell: (p) => (
        <div className="flex items-center gap-1.5">
          <StatusBadge
            status={p.status}
            colorMap={PROJECT_STATUS_COLORS}
            labelMap={PROJECT_STATUS_LABELS}
          />
          {p.stage && (
            <StatusBadge
              status={p.stage}
              colorMap={PROJECT_STAGE_COLORS}
              labelMap={PROJECT_STAGE_LABELS}
            />
          )}
        </div>
      ),
    },
    {
      header: "Account Manager",
      sortValue: (p) => `${p.owner.firstName} ${p.owner.lastName}`.trim(),
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
      sortValue: (p) => p._count.tasks,
      className: "text-muted-foreground",
      cell: (p) => p._count.tasks,
    },
    {
      header: "Employees",
      align: "center",
      sortValue: (p) => p.members.length,
      className: "text-muted-foreground",
      cell: (p) => p.members.length,
    },
    ...(showBudget
      ? [
          {
            header: "Budget",
            align: "right" as const,
            className: "text-xs",
            sortValue: budgetOf,
            cell: (p: Project) => {
              const budget = budgetOf(p)
              return budget != null ? (
                `₹${budget.toLocaleString("en-IN")}`
              ) : (
                <span className="text-muted-foreground">-</span>
              )
            },
          },
        ]
      : []),
    {
      header: "Actions",
      align: "right",
      cell: (p) => (
        <div className="flex items-center justify-end gap-0.5">
          <Button variant="ghost" size="icon" asChild title="View details">
            <Link href={projectHref(p)} aria-label={`View ${p.name}`}>
              <Eye className="h-4 w-4" />
            </Link>
          </Button>
          {canManageProject(p) && (
            <Button
              variant="ghost"
              size="icon"
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
          <div className="flex flex-wrap items-center gap-2">
            {canWrite && (
              <Button className="gap-2" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" /> New Project
              </Button>
            )}
          </div>
        }
      />

      {!isLoading && allProjects.length === 0 ? (
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
        <DataTable
          loading={isLoading}
          tableId="projects"
          exportName="projects"
          itemLabel="project"
          columns={tableColumns}
          rows={tableProjects}
          rowKey={(p) => p.id}
          showSerial
          pageKey={`${service}|${status}|${needle}`}
          toolbar={
            <>
              <TableViewMenu
                label="Status"
                value={status}
                options={statusViews}
                onChange={setStatus}
              />
              <TableSearch
                value={query}
                onChange={setQuery}
                placeholder="Name, short name, client or AM"
                label="Search projects"
              />
              <Select value={service} onValueChange={setService}>
                <SelectTrigger className="h-9 w-48" aria-label="Filter by service">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_SERVICES}>All services</SelectItem>
                  {PROJECT_SERVICES.map((s) => (
                    <SelectItem key={s.code} value={s.code}>
                      {s.label} <span className="text-muted-foreground">· {s.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          }
          empty={
            needle
              ? "No project matches that search."
              : service !== ALL_SERVICES
                ? "No projects include this service."
                : "No projects with this status."
          }
        />
      )}

      <ProjectServicesDialog
        project={servicesOf}
        projectPath={servicesOf ? projectHref(servicesOf) : ""}
        canManage={servicesOf ? canManageProject(servicesOf) : false}
        onClose={() => setServicesOfId(null)}
      />
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
            shortName: editing.shortName ?? "",
            services: editing.services,
            code: editing.code,
            description: editing.description ?? "",
            status: editing.status,
            priority: editing.priority,
            stage: editing.stage ?? "",
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
