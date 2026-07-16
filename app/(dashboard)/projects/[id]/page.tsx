"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { useParams } from "next/navigation"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { StatStrip } from "@/components/shared/stat-strip"
import { InfoRow } from "@/components/shared/info-row"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { useProject, useProjectTeams, useUnreadMessageCount } from "@/features/projects"
import { usePermissions } from "@/features/admin"
import {
  PERMISSIONS,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_COLORS,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_COLORS,
} from "@/lib/constants"
import { formatDate } from "@/lib/utils"
import {
  ChevronLeft,
  Calendar,
  Users,
  FolderKanban,
  Layers,
  Pencil,
  Activity,
  MessageSquare,
  KeyRound,
  Sparkles,
  HardDrive,
  Plug,
  BarChart3,
} from "lucide-react"
import { ProjectFormDialog } from "@/features/projects"

// The 7 tab bodies are ~4,000 lines combined, but Radix only RENDERS the active
// one - so statically importing them made every visit download and parse all of
// them up front. Each now loads on first activation.
const tabFallback = () => <Skeleton className="mt-4 h-64 rounded" />
const BrandTab = dynamic(() => import("@/features/projects").then((m) => m.BrandTab), {
  loading: tabFallback,
})
const DriveTab = dynamic(() => import("@/features/projects").then((m) => m.DriveTab), {
  loading: tabFallback,
})
const IntegrationTab = dynamic(() => import("@/features/projects").then((m) => m.IntegrationTab), {
  loading: tabFallback,
})
const InsightsTab = dynamic(() => import("@/features/projects").then((m) => m.InsightsTab), {
  loading: tabFallback,
})
const TeamsTab = dynamic(() => import("@/features/projects").then((m) => m.TeamsTab), {
  loading: tabFallback,
})
const TasksTab = dynamic(() => import("@/features/projects").then((m) => m.TasksTab), {
  loading: tabFallback,
})
const ActivityTab = dynamic(() => import("@/features/projects").then((m) => m.ActivityTab), {
  loading: tabFallback,
})
const MessagesTab = dynamic(() => import("@/features/projects").then((m) => m.MessagesTab), {
  loading: tabFallback,
})
const PasswordsTab = dynamic(() => import("@/features/projects").then((m) => m.PasswordsTab), {
  loading: tabFallback,
})

export default function ProjectDetailPage() {
  const params = useParams()
  const projectId = params.id as string
  const { data: session } = useSession()
  const { can } = usePermissions()

  const userId = session?.user?.id ?? ""

  const { data, isLoading } = useProject(projectId)
  const project = data?.data
  const { data: teamsData } = useProjectTeams(projectId)
  const teams = teamsData?.data ?? []
  const { data: unreadMessages = 0 } = useUnreadMessageCount(projectId)

  // Admins/PMs with project:write can manage any project; the project's ACCOUNT
  // MANAGER (owner) can fully manage their own project too.
  const canManage = can(PERMISSIONS.PROJECT_WRITE) || (!!project && project.owner.id === userId)

  const [editOpen, setEditOpen] = useState(false)

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
      <PageHeader
        className="space-y-4"
        backHref="/projects"
        backLabel="Back to projects"
        title={project.name}
        titleSuffix={
          <span className="bg-muted/50 text-muted-foreground shrink-0 rounded border px-2 py-0.5 font-mono text-xs">
            {project.code}
          </span>
        }
        /* The description is NOT passed here: PageHeader's subtitle truncates to one
           line, but a project description is a full paragraph, so it is rendered in
           full below the header instead. */
        /* Status + priority are sized to match the Edit button: same height,
           same corner radius, so the row reads as one control group. */
        actions={
          <>
            <StatusBadge
              status={project.status}
              colorMap={PROJECT_STATUS_COLORS}
              labelMap={PROJECT_STATUS_LABELS}
              size="button"
            />
            <StatusBadge
              status={project.priority}
              colorMap={TASK_PRIORITY_COLORS}
              label={`${TASK_PRIORITY_LABELS[project.priority]} priority`}
              size="button"
            />
            {canManage && (
              <Button variant="outline" size="sm" className="h-8" onClick={() => setEditOpen(true)}>
                <Pencil className="mr-1 h-3.5 w-3.5" />
                Edit
              </Button>
            )}
          </>
        }
      />

      {project.description && (
        <p className="text-muted-foreground -mt-7 max-w-4xl text-sm leading-relaxed whitespace-pre-line">
          {project.description}
        </p>
      )}

      <Tabs defaultValue="overview">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="overview" className="gap-1.5">
              <Layers className="h-3.5 w-3.5" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="brand" className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Brand
            </TabsTrigger>
            <TabsTrigger value="drive" className="gap-1.5">
              <HardDrive className="h-3.5 w-3.5" />
              Files
            </TabsTrigger>
            <TabsTrigger value="integration" className="gap-1.5">
              <Plug className="h-3.5 w-3.5" />
              Integration
            </TabsTrigger>
            <TabsTrigger value="insights" className="gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              Insights
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
              {unreadMessages > 0 && (
                <span className="bg-primary text-primary-foreground ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none font-semibold">
                  {unreadMessages > 99 ? "99+" : unreadMessages}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-1.5">
              <Activity className="h-3.5 w-3.5" />
              Activity
            </TabsTrigger>
            <TabsTrigger value="passwords" className="gap-1.5">
              <KeyRound className="h-3.5 w-3.5" />
              Passwords
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <StatStrip
            items={[
              { label: "Teams", value: teams.length },
              { label: "Members", value: totalMembers },
              { label: "Tasks", value: totalTasks },
              // Budget is manager-only, so the strip is 4-up for them and 3-up
              // for everyone else.
              ...(canManage
                ? [
                    {
                      label: "Budget",
                      value: project.budget ? `₹${project.budget.toLocaleString("en-IN")}` : "-",
                      isText: true,
                    },
                  ]
                : []),
            ]}
          />

          <Card>
            <CardContent className="space-y-4 p-5">
              {/* Account Manager - featured card */}
              <div>
                <p className="text-muted-foreground mb-2 text-[10px] font-medium tracking-widest uppercase">
                  Account Manager
                </p>
                <div className="flex items-center gap-3">
                  <AvatarDisplay
                    src={project.owner.profilePhoto}
                    firstName={project.owner.firstName}
                    lastName={project.owner.lastName}
                    size="md"
                  />
                  <div>
                    <p className="font-medium">
                      {project.owner.firstName} {project.owner.lastName}
                    </p>
                    <p className="text-muted-foreground text-xs">Lead manager for this project</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 border-t pt-3 text-sm sm:grid-cols-3">
                <InfoRow label="Code" value={project.code} mono />
                <InfoRow
                  label="Onboarding Date"
                  value={project.startDate ? formatDate(project.startDate) : "-"}
                  icon={Calendar}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="brand">
          <BrandTab projectId={projectId} canManage={canManage} />
        </TabsContent>

        <TabsContent value="drive">
          <DriveTab projectId={projectId} canManage={canManage} />
        </TabsContent>

        <TabsContent value="integration">
          <IntegrationTab projectId={projectId} canManage={canManage} />
        </TabsContent>

        <TabsContent value="insights">
          <InsightsTab projectId={projectId} canManage={canManage} />
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
