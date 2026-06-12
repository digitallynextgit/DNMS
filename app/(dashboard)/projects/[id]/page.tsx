"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import Link from "next/link"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useProject, useProjectTeams } from "@/hooks/use-projects"
import { usePermissions } from "@/hooks/use-permissions"
import {
  PERMISSIONS,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_COLORS,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_COLORS,
} from "@/lib/constants"
import { cn, formatDate, getInitials } from "@/lib/utils"
import {
  ChevronLeft,
  ChevronDown,
  Calendar,
  Users,
  FolderKanban,
  FileText,
  Layers,
  Pencil,
  GitBranch,
  Activity,
  MessageSquare,
  KeyRound,
} from "lucide-react"
import { TeamsTab } from "@/components/projects/teams-tab"
import { TasksTab } from "@/components/projects/tasks-tab"
import { ResourcesTab } from "@/components/projects/resources-tab"
import { ActivityTab } from "@/components/projects/activity-tab"
import { MessagesTab } from "@/components/projects/messages-tab"
import { PasswordsTab } from "@/components/projects/passwords-tab"
import { ProjectFormDialog } from "@/components/projects/project-form-dialog"

interface SubPhase {
  id: string
  name: string
  displayOrder: number
  isActive: boolean
  parentId: string
}
interface Phase {
  id: string
  name: string
  displayOrder: number
  isActive: boolean
  parentId: null
  children: SubPhase[]
}
async function fetchPhases(): Promise<{ data: Phase[] }> {
  const res = await fetch("/api/project-phases")
  if (!res.ok) throw new Error()
  return res.json()
}

function getPhaseLabel(phaseId: string | null | undefined, phases: Phase[]): string {
  if (!phaseId) return ""
  for (const p of phases) {
    if (p.id === phaseId) return p.name
    const child = p.children.find((c) => c.id === phaseId)
    if (child) return `${p.name} › ${child.name}`
  }
  return ""
}

export default function ProjectDetailPage() {
  const params = useParams()
  const projectId = params.id as string
  const { data: session } = useSession()
  const { can } = usePermissions()

  const canManage = can(PERMISSIONS.PROJECT_WRITE)
  const userId = session?.user?.id ?? ""

  const { data, isLoading } = useProject(projectId)
  const project = data?.data
  const { data: teamsData } = useProjectTeams(projectId)
  const teams = teamsData?.data ?? []

  const [editOpen, setEditOpen] = useState(false)

  const qc = useQueryClient()
  const { data: phasesData } = useQuery({ queryKey: ["project-phases"], queryFn: fetchPhases })
  const phases = (phasesData?.data ?? []).filter((p) => p.isActive)

  const changePhase = useMutation({
    mutationFn: async (phaseId: string) => {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPhaseId: phaseId || null }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to update phase" }))
        throw new Error(err.error || "Failed to update phase")
      }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId] })
      toast.success("Phase updated")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 rounded" />
        <Skeleton className="h-96 rounded" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground text-sm">Project not found.</p>
        <Button variant="outline" asChild className="mt-4">
          <Link href="/projects">
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back to projects
          </Link>
        </Button>
      </div>
    )
  }

  const totalMembers = teams.reduce((sum, t) => sum + t.members.length, 0)
  const totalTasks = teams.reduce((sum, t) => sum + t._count.tasks, 0)

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/projects">
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back to projects
          </Link>
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
              <Badge variant="outline" className="font-mono text-xs">
                {project.code}
              </Badge>
            </div>
            {project.description && (
              <p className="text-muted-foreground mt-1 max-w-2xl text-sm">{project.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn("text-xs", PROJECT_STATUS_COLORS[project.status])}
            >
              {PROJECT_STATUS_LABELS[project.status]}
            </Badge>
            <Badge
              variant="outline"
              className={cn("text-xs", TASK_PRIORITY_COLORS[project.priority])}
            >
              {TASK_PRIORITY_LABELS[project.priority]} priority
            </Badge>
            {canManage && (
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="mr-1 h-3.5 w-3.5" />
                Edit
              </Button>
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="overview" className="gap-1.5">
              <Layers className="h-3.5 w-3.5" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="teams" className="gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Teams
            </TabsTrigger>
            <TabsTrigger value="tasks" className="gap-1.5">
              <FolderKanban className="h-3.5 w-3.5" />
              Tasks
            </TabsTrigger>
            <TabsTrigger value="messages" className="gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              Messages
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-1.5">
              <Activity className="h-3.5 w-3.5" />
              Activity
            </TabsTrigger>
            <TabsTrigger value="passwords" className="gap-1.5">
              <KeyRound className="h-3.5 w-3.5" />
              Passwords
            </TabsTrigger>
            <TabsTrigger value="resources" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Resources
            </TabsTrigger>
          </TabsList>

          {/* Phase cascading dropdown - right of tabs */}
          <div className="flex items-center gap-2">
            <GitBranch className="text-muted-foreground h-3.5 w-3.5" />
            <span className="text-muted-foreground text-xs">Phase:</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild disabled={!canManage}>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 max-w-56 min-w-36 justify-between gap-2 px-3 text-sm font-normal"
                >
                  <span className="truncate">
                    {project.currentPhase?.id ? (
                      getPhaseLabel(project.currentPhase.id, phases)
                    ) : (
                      <span className="text-muted-foreground">
                        {phases.length === 0 ? "No phases" : "Select phase"}
                      </span>
                    )}
                  </span>
                  <ChevronDown className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  className="text-muted-foreground text-sm"
                  onClick={() => changePhase.mutate("")}
                >
                  - None —
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {phases.map((p) =>
                  p.children.filter((c) => c.isActive).length > 0 ? (
                    <DropdownMenuSub key={p.id}>
                      <DropdownMenuSubTrigger className="text-sm font-medium">
                        {p.name}
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-48">
                        <DropdownMenuItem
                          className="text-muted-foreground text-sm italic"
                          onClick={() => changePhase.mutate(p.id)}
                        >
                          {p.name} (general)
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {p.children
                          .filter((c) => c.isActive)
                          .map((c) => (
                            <DropdownMenuItem
                              key={c.id}
                              className="text-sm"
                              onClick={() => changePhase.mutate(c.id)}
                            >
                              {c.name}
                            </DropdownMenuItem>
                          ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  ) : (
                    <DropdownMenuItem
                      key={p.id}
                      className="text-sm font-medium"
                      onClick={() => changePhase.mutate(p.id)}
                    >
                      {p.name}
                    </DropdownMenuItem>
                  ),
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <Card>
            <CardContent className="p-0">
              <div
                className={cn(
                  "divide-border grid divide-x divide-y sm:divide-y-0",
                  canManage ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3",
                )}
              >
                <Stat label="Teams" value={teams.length} />
                <Stat label="Members" value={totalMembers} />
                <Stat label="Tasks" value={totalTasks} />
                {canManage && (
                  <Stat
                    label="Budget"
                    value={project.budget ? `₹${project.budget.toLocaleString("en-IN")}` : "—"}
                    isText
                  />
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-5">
              {/* Account Manager - featured card */}
              <div>
                <p className="text-muted-foreground mb-2 text-[10px] font-medium tracking-widest uppercase">
                  Account Manager
                </p>
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    {project.owner.profilePhoto && <AvatarImage src={project.owner.profilePhoto} />}
                    <AvatarFallback>
                      {getInitials(project.owner.firstName, project.owner.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">
                      {project.owner.firstName} {project.owner.lastName}
                    </p>
                    <p className="text-muted-foreground text-xs">Lead manager for this project</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 border-t pt-3 text-sm sm:grid-cols-3">
                <Field label="Code" value={project.code} mono />
                <Field
                  label="Onboarding Date"
                  value={project.startDate ? formatDate(project.startDate) : "—"}
                  icon={Calendar}
                />
                <Field label="Phase" value={project.currentPhase?.name ?? "—"} icon={GitBranch} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="teams" className="mt-4">
          <TeamsTab projectId={projectId} canManage={canManage} currentUserId={userId} />
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          <TasksTab projectId={projectId} currentUserId={userId} isAdmin={canManage} />
        </TabsContent>

        <TabsContent value="messages" className="mt-4">
          <MessagesTab projectId={projectId} currentUserId={userId} canManage={canManage} />
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <ActivityTab projectId={projectId} />
        </TabsContent>

        <TabsContent value="passwords" className="mt-4">
          <PasswordsTab projectId={projectId} currentUserId={userId} canManage={canManage} />
        </TabsContent>

        <TabsContent value="resources" className="mt-4">
          <ResourcesTab projectId={projectId} currentUserId={userId} isProjectAdmin={canManage} />
        </TabsContent>
      </Tabs>

      {/* Edit dialog */}
      <ProjectFormDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        mode="edit"
        projectId={projectId}
        initial={{
          name: project.name,
          code: project.code,
          description: project.description ?? "",
          status: project.status,
          priority: project.priority,
          startDate: project.startDate ? project.startDate.split("T")[0] : "",
          budget: project.budget != null ? String(project.budget) : "",
          accountManagerId: project.owner.id,
        }}
      />
    </div>
  )
}

function Stat({
  label,
  value,
  isText,
}: {
  label: string
  value: number | string
  isText?: boolean
}) {
  return (
    <div className="px-4 py-3">
      <p className="text-muted-foreground text-[10px] font-medium tracking-widest uppercase">
        {label}
      </p>
      <p className={cn("mt-1 tabular-nums", isText ? "text-sm font-medium" : "text-xl font-bold")}>
        {value}
      </p>
    </div>
  )
}

function Field({
  label,
  value,
  icon: Icon,
  mono,
}: {
  label: string
  value: string
  icon?: React.ElementType
  mono?: boolean
}) {
  return (
    <div>
      <p className="text-muted-foreground text-[10px] font-medium tracking-widest uppercase">
        {label}
      </p>
      <p className={cn("mt-1 flex items-center gap-1.5", mono && "font-mono")}>
        {Icon && <Icon className="text-muted-foreground h-3.5 w-3.5" />}
        {value}
      </p>
    </div>
  )
}
