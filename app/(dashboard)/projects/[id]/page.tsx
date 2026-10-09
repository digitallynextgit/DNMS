"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { Link } from "@/components/tenant-link"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { StatStrip } from "@/components/shared/stat-strip"
import { InfoRow } from "@/components/shared/info-row"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { AvatarDisplay } from "@/components/shared/avatar-display"
// Concrete modules, never the feature barrel: a static barrel import would put the whole
// feature in this page's eager chunk and defeat every dynamic() below.
import {
  useProject,
  useProjectTeams,
  useUnreadMessageCount,
  useProjectRequirements,
} from "@/features/projects/hooks/use-projects"
import { usePermissions } from "@/features/admin/hooks/use-permissions"
import {
  PERMISSIONS,
  PROJECT_STAGE_COLORS,
  PROJECT_STAGE_LABELS,
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
  Mail,
  KeyRound,
  Palette,
  CalendarDays,
  HardDrive,
  BarChart3,
  Search,
  HelpCircle,
  Target,
  PackageCheck,
  Building2,
} from "lucide-react"
import { ProjectFormDialog } from "@/features/projects/components/project-form-dialog"
import { clientHref } from "@/features/clients/lib/client-href"
import { ProjectLogo } from "@/features/projects/components/project-logo"
import {
  ProjectTabsBar,
  type ProjectTabItem,
} from "@/features/projects/components/project-tabs-bar"

// Radix renders only the active tab, so each tab body loads on first activation.
const tabFallback = () => <Skeleton className="mt-4 h-64 rounded-sm" />
const BrandTab = dynamic(
  () => import("@/features/projects/components/brand-tab").then((m) => m.BrandTab),
  {
    loading: tabFallback,
  },
)
const ContentCalendarTab = dynamic(
  () => import("@/features/projects/components/project-sheet").then((m) => m.ProjectSheetSection),
  {
    loading: tabFallback,
  },
)
const DriveTab = dynamic(
  () => import("@/features/projects/components/drive-tab").then((m) => m.DriveTab),
  {
    loading: tabFallback,
  },
)
const InsightsTab = dynamic(
  () => import("@/features/projects/components/insights-tab").then((m) => m.InsightsTab),
  {
    loading: tabFallback,
  },
)
// Concrete module, not the barrel (see the top of the imports).
const GoalsTab = dynamic(
  () => import("@/features/projects/components/goals-tab").then((m) => m.GoalsTab),
  { loading: tabFallback },
)
const DeliverablesTab = dynamic(
  () => import("@/features/projects/components/deliverables-tab").then((m) => m.DeliverablesTab),
  { loading: tabFallback },
)
// Dynamic even on Overview: it pulls in recharts, too heavy for the eager chunk.
const GoalsOverviewCard = dynamic(
  () =>
    import("@/features/projects/components/goals-overview-card").then((m) => m.GoalsOverviewCard),
  { loading: () => <Skeleton className="h-56 rounded-sm" /> },
)
const SeoTab = dynamic(() => import("@/features/seo/components/seo-tab").then((m) => m.SeoTab), {
  loading: tabFallback,
})
const ProjectSitesCard = dynamic(
  () => import("@/features/seo/components/project-sites-card").then((m) => m.ProjectSitesCard),
  { loading: () => null },
)
const TeamsTab = dynamic(
  () => import("@/features/projects/components/teams-tab").then((m) => m.TeamsTab),
  {
    loading: tabFallback,
  },
)
const TasksTab = dynamic(
  () => import("@/features/projects/components/tasks-tab").then((m) => m.TasksTab),
  {
    loading: tabFallback,
  },
)
const RequirementsTab = dynamic(
  () => import("@/features/projects/components/requirements-tab").then((m) => m.RequirementsTab),
  { loading: tabFallback },
)
const ActivityTab = dynamic(
  () => import("@/features/projects/components/activity-tab").then((m) => m.ActivityTab),
  {
    loading: tabFallback,
  },
)
const MessagesTab = dynamic(
  () => import("@/features/projects/components/messages-tab").then((m) => m.MessagesTab),
  {
    loading: tabFallback,
  },
)
const PasswordsTab = dynamic(
  () => import("@/features/projects/components/passwords-tab").then((m) => m.PasswordsTab),
  {
    loading: tabFallback,
  },
)
const ProjectMailerTab = dynamic(
  () => import("@/features/project-mailer").then((m) => m.ProjectMailerTab),
  { loading: tabFallback },
)
const ProjectMonitoringTab = dynamic(
  () => import("@/features/monitoring").then((m) => m.ProjectMonitoringTab),
  { loading: tabFallback },
)

/** Every valid ?tab= value. The tab bar is typed against it, so a tab missing here fails the build. */
const PROJECT_TABS = [
  "overview",
  "brand",
  "goals",
  "calendar",
  "deliverables",
  "repository",
  "insights",
  "seo",
  "teams",
  "tasks",
  "requirements",
  "messages",
  "activity",
  "passwords",
  "monitoring",
  "mailer",
] as const

export default function ProjectDetailPage() {
  const params = useParams()
  // A slug for newer links, a uuid for older ones. See projectRef below.
  const slugOrId = params.id as string
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const { can } = usePermissions()

  const userId = session?.user?.id ?? ""

  // The tab lives in the URL so a reload or shared link lands on the same tab.
  const rawTab = searchParams.get("tab")
  // Renamed tabs: "drive" is now Repository; "integration" is the Connections dialog in Insights.
  const tabParam =
    rawTab === "drive" ? "repository" : rawTab === "integration" ? "insights" : rawTab
  const activeTab = PROJECT_TABS.includes(tabParam as (typeof PROJECT_TABS)[number])
    ? (tabParam as string)
    : "overview"
  const handleTabChange = (value: string) => {
    const next = new URLSearchParams(Array.from(searchParams.entries()))
    next.set("tab", value)
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }

  /**
   * The RAW URL segment (slug or uuid) - every /api/projects/[id]/* route resolves either form.
   * Not project.slug: it's known before the project loads, so the header and tabs fetch in
   * parallel and share ONE cache entry.
   */
  const projectRef = slugOrId

  const { data, isLoading } = useProject(projectRef)
  const project = data?.data

  // Same key as the Teams and Messages tabs use, so they share a cache entry.
  const { data: teamsData } = useProjectTeams(projectRef)
  const teams = teamsData?.data ?? []
  const { data: unreadMessages = 0 } = useUnreadMessageCount(projectRef)

  // Badge on the Requirements tab: how much the project is currently blocked on.
  const { data: requirementsData } = useProjectRequirements(projectRef)
  const openRequirements = (requirementsData?.data ?? []).filter(
    (r) => r.status === "OPEN" || r.status === "IN_PROGRESS",
  ).length

  // project:write holders manage any project; the account manager (owner) manages their own.
  const canManage = can(PERMISSIONS.PROJECT_WRITE) || (!!project && project.owner.id === userId)

  /**
   * A ?tab=passwords bookmark for someone who may not see it. Judged only once the project has
   * LOADED - canManage is false mid-fetch and would bounce the account manager off their own.
   */
  const shownTab =
    Boolean(project) && !canManage && activeTab === "passwords" ? "overview" : activeTab

  const [editOpen, setEditOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-4 py-4">
          <Skeleton className="h-3 w-28 rounded-sm" />
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 shrink-0 rounded-sm" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-48 rounded-sm" />
                <Skeleton className="h-3 w-24 rounded-sm" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-24 rounded-sm" />
              <Skeleton className="h-8 w-28 rounded-sm" />
              <Skeleton className="h-8 w-16 rounded-sm" />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b pb-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-sm" />
          ))}
        </div>
        <Skeleton className="h-16 w-full rounded-sm" />
        <Skeleton className="h-40 w-full rounded-sm" />
        <Skeleton className="h-64 w-full rounded-sm" />
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

  // People, not seats: someone can be on several of the project's teams.
  const totalMembers = new Set(teams.flatMap((t) => t.members.map((m) => m.employeeId))).size
  const totalTasks = teams.reduce((sum, t) => sum + t._count.tasks, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        className="space-y-4"
        backHref="/projects"
        backLabel="Back to projects"
        leading={<ProjectLogo src={project.logo} name={project.name} className="h-10 w-10" />}
        title={project.name}
        titleSuffix={
          <>
            <span className="bg-muted/50 text-muted-foreground shrink-0 rounded-sm border px-2 py-0.5 font-mono text-xs">
              {project.code}
            </span>
            {project.client && (
              <Link
                href={clientHref(project.client)}
                className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-1 text-xs hover:underline"
              >
                <Building2 className="h-3.5 w-3.5" />
                {project.client.name}
              </Link>
            )}
          </>
        }
        /* No description here: the subtitle truncates to one line, so it's shown in full below. */
        actions={
          <>
            {project.stage && (
              <StatusBadge
                status={project.stage}
                colorMap={PROJECT_STAGE_COLORS}
                label={`${PROJECT_STAGE_LABELS[project.stage] ?? project.stage} phase`}
                size="button"
              />
            )}
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
              <Button variant="outline" onClick={() => setEditOpen(true)}>
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

      <Tabs value={shownTab} onValueChange={handleTabChange}>
        {/* Tabs are data: ProjectTabsBar measures them and moves what doesn't fit to a second strip. */}
        <ProjectTabsBar
          items={
            [
              { value: "overview", label: "Overview", icon: Layers },
              { value: "brand", label: "Brand", icon: Palette },
              { value: "goals", label: "Goals", icon: Target },
              { value: "calendar", label: "Calendars", icon: CalendarDays },
              { value: "deliverables", label: "Deliverables", icon: PackageCheck },
              { value: "repository", label: "Repository", icon: HardDrive },
              { value: "insights", label: "Insights", icon: BarChart3 },
              { value: "seo", label: "SEO", icon: Search },
              { value: "teams", label: "Teams", icon: Users },
              { value: "tasks", label: "Tasks", icon: FolderKanban },
              {
                value: "requirements",
                label: "Requirements",
                icon: HelpCircle,
                badge: openRequirements,
                badgeClassName: "bg-amber-500",
              },
              {
                value: "messages",
                label: "Chats",
                icon: MessageSquare,
                badge: unreadMessages,
              },
              { value: "activity", label: "Activity", icon: Activity },
              // Account Manager and project admins only, matching the guard on every /passwords route.
              ...(canManage
                ? [{ value: "passwords" as const, label: "Passwords", icon: KeyRound }]
                : []),
              // Open to the whole project team, not only the owner.
              { value: "monitoring", label: "Monitoring", icon: Activity },
              { value: "mailer", label: "Mailer", icon: Mail },
              // Portal access lives on the client's page (Clients -> Contacts), not here.
            ] satisfies {
              value: (typeof PROJECT_TABS)[number]
              label: string
              icon: unknown
              badge?: number
              badgeClassName?: string
            }[] as ProjectTabItem[]
          }
        />

        <TabsContent value="overview" className="mt-4 space-y-4">
          <StatStrip
            items={[
              { label: "Teams", value: teams.length },
              { label: "Members", value: totalMembers },
              { label: "Tasks", value: totalTasks },
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

          {/* Shares its query with the Goals tab. */}
          <GoalsOverviewCard projectId={projectRef} onOpen={() => handleTabChange("goals")} />

          <ProjectSitesCard projectId={projectRef} onOpenSeo={() => handleTabChange("seo")} />
        </TabsContent>

        <TabsContent value="goals" className="mt-4">
          <GoalsTab projectId={projectRef} canManage={canManage} currentUserId={userId} />
        </TabsContent>

        <TabsContent value="deliverables" className="mt-4">
          <DeliverablesTab projectId={projectRef} canManage={canManage} currentUserId={userId} />
        </TabsContent>

        <TabsContent value="calendar">
          <div className="mt-4">
            <ContentCalendarTab projectId={projectRef} canManage={canManage} />
          </div>
        </TabsContent>
        <TabsContent value="brand">
          <BrandTab projectId={projectRef} canManage={canManage} />
        </TabsContent>

        <TabsContent value="repository">
          <DriveTab projectId={projectRef} canManage={canManage} />
        </TabsContent>

        <TabsContent value="insights">
          <InsightsTab projectId={projectRef} canManage={canManage} />
        </TabsContent>

        <TabsContent value="seo">
          <SeoTab projectId={projectRef} canManage={canManage} />
        </TabsContent>

        <TabsContent value="teams" className="mt-4">
          <TeamsTab projectId={projectRef} canManage={canManage} currentUserId={userId} />
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          <TasksTab projectId={projectRef} currentUserId={userId} isAdmin={canManage} />
        </TabsContent>

        <TabsContent value="requirements" className="mt-4">
          <RequirementsTab projectId={projectRef} currentUserId={userId} canManage={canManage} />
        </TabsContent>

        <TabsContent value="messages" className="mt-4">
          <MessagesTab projectId={projectRef} currentUserId={userId} canManage={canManage} />
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <ActivityTab projectId={projectRef} />
        </TabsContent>

        {canManage && (
          <TabsContent value="passwords" className="mt-4">
            <PasswordsTab projectId={projectRef} currentUserId={userId} canManage={canManage} />
          </TabsContent>
        )}

        {/* Always true: reaching this page means project access, which is what both APIs check. */}
        <TabsContent value="monitoring" className="mt-4">
          <ProjectMonitoringTab projectRef={projectRef} canManage />
        </TabsContent>

        <TabsContent value="mailer" className="mt-4">
          <ProjectMailerTab projectRef={projectRef} canManage />
        </TabsContent>
      </Tabs>

      <ProjectFormDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        mode="edit"
        projectId={projectRef}
        logo={project.logo}
        initial={{
          name: project.name,
          code: project.code,
          description: project.description ?? "",
          status: project.status,
          priority: project.priority,
          stage: project.stage ?? "",
          startDate: project.startDate ? project.startDate.split("T")[0] : "",
          budget: project.budget != null ? String(project.budget) : "",
          accountManagerId: project.owner.id,
          clientId: project.client?.id ?? "",
          clientName: project.client?.name,
        }}
      />
    </div>
  )
}
