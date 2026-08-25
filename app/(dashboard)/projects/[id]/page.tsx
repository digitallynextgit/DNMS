"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { StatStrip } from "@/components/shared/stat-strip"
import { InfoRow } from "@/components/shared/info-row"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { AvatarDisplay } from "@/components/shared/avatar-display"
// Concrete modules, never the feature barrel: a static barrel import lands the
// WHOLE feature in this page's eager chunk, which silently defeats every
// dynamic() below (they would resolve to already-loaded code).
import {
  useProject,
  useProjectTeams,
  useUnreadMessageCount,
  useProjectRequirements,
} from "@/features/projects/hooks/use-projects"
import { usePermissions } from "@/features/admin/hooks/use-permissions"
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
  Mail,
  KeyRound,
  UserCog,
  Sparkles,
  HardDrive,
  Plug,
  BarChart3,
  Search,
  HelpCircle,
} from "lucide-react"
import { ProjectFormDialog } from "@/features/projects/components/project-form-dialog"
import { ProjectLogo } from "@/features/projects/components/project-logo"
import { ProjectTabsBar } from "@/features/projects/components/project-tabs-bar"

// The 7 tab bodies are ~4,000 lines combined, but Radix only RENDERS the active
// one - so statically importing them made every visit download and parse all of
// them up front. Each now loads on first activation.
const tabFallback = () => <Skeleton className="mt-4 h-64 rounded" />
const BrandTab = dynamic(
  () => import("@/features/projects/components/brand-tab").then((m) => m.BrandTab),
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
const IntegrationTab = dynamic(
  () => import("@/features/projects/components/integration-tab").then((m) => m.IntegrationTab),
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
// Recharts is heavy, so the Overview's summary loads on demand like the tabs do.
const ProgressOverview = dynamic(
  () => import("@/features/projects").then((m) => m.ProgressOverview),
  { loading: () => <Skeleton className="h-64 rounded" /> },
)
const SeoTab = dynamic(() => import("@/features/seo").then((m) => m.SeoTab), {
  loading: tabFallback,
})
// Small enough to render inline on Overview; self-hides when there are no sites.
const ProjectSitesCard = dynamic(() => import("@/features/seo").then((m) => m.ProjectSitesCard), {
  loading: () => null,
})
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
  () => import("@/features/projects").then((m) => m.RequirementsTab),
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
const ProjectClientsTab = dynamic(
  () => import("@/features/client-portal").then((m) => m.ProjectClientsTab),
  { loading: tabFallback },
)
const ProjectMailerTab = dynamic(
  () => import("@/features/project-mailer").then((m) => m.ProjectMailerTab),
  { loading: tabFallback },
)
const ProjectMonitoringTab = dynamic(
  () => import("@/features/monitoring").then((m) => m.ProjectMonitoringTab),
  { loading: tabFallback },
)

const PROJECT_TABS = [
  "overview",
  "brand",
  "drive",
  "integration",
  "insights",
  "seo",
  "teams",
  "tasks",
  "requirements",
  "messages",
  "activity",
  "passwords",
  "clients",
  "monitoring",
  "mailer",
] as const

export default function ProjectDetailPage() {
  const params = useParams()
  // What the URL carries: a slug ("rudione-leocym") for anything created or
  // linked since slugs landed, a uuid for older links. See `projectRef` below.
  const slugOrId = params.id as string
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const { can } = usePermissions()

  const userId = session?.user?.id ?? ""

  // Keep the active tab in the URL so a reload (or a shared/deep link) lands on
  // the same tab instead of snapping back to Overview.
  const tabParam = searchParams.get("tab")
  const activeTab = PROJECT_TABS.includes(tabParam as (typeof PROJECT_TABS)[number])
    ? (tabParam as string)
    : "overview"
  const handleTabChange = (value: string) => {
    const next = new URLSearchParams(Array.from(searchParams.entries()))
    next.set("tab", value)
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }

  /**
   * The project reference every request URL and cache key on this page is built
   * from: the RAW URL segment, i.e. the slug for anything created or linked
   * since slugs landed, a uuid for older links.
   *
   * Every /api/projects/[id]/* route resolves either form - the project guards
   * (withProjectAccess / withProjectManager / withTeamStaffing) always did, and
   * the handful behind plain withSession/withAuth now call resolveProjectId
   * themselves - so the readable form is safe end to end.
   *
   * Deliberately the URL segment rather than `project.slug`: it is known before
   * the project has loaded, so the header hooks below fetch in parallel instead
   * of waiting on it, and it never changes mid-session. That last part is what
   * keeps the header and the tabs on ONE cache entry - keyed differently they
   * would drift, and the header counts would go stale the moment a tab
   * invalidated its own copy.
   */
  const projectRef = slugOrId

  // GET /api/projects/[id] is behind `withProjectAccess`, which resolves a slug
  // or an id.
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

  // Admins/PMs with project:write can manage any project; the project's ACCOUNT
  // MANAGER (owner) can fully manage their own project too.
  const canManage = can(PERMISSIONS.PROJECT_WRITE) || (!!project && project.owner.id === userId)

  const [editOpen, setEditOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header: logo + name/code + status/priority + Edit */}
        <div className="space-y-4 py-4">
          <Skeleton className="h-3 w-28 rounded" />
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 shrink-0 rounded" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-48 rounded" />
                <Skeleton className="h-3 w-24 rounded" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-24 rounded" />
              <Skeleton className="h-8 w-28 rounded" />
              <Skeleton className="h-8 w-16 rounded" />
            </div>
          </div>
        </div>
        {/* Tab bar */}
        <div className="flex flex-wrap items-center gap-2 border-b pb-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded" />
          ))}
        </div>
        {/* Overview stat strip */}
        <Skeleton className="h-16 w-full rounded" />
        {/* Overview body */}
        <Skeleton className="h-40 w-full rounded" />
        <Skeleton className="h-64 w-full rounded" />
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
        leading={<ProjectLogo src={project.logo} name={project.name} className="h-10 w-10" />}
        title={project.name}
        titleSuffix={
          <span className="bg-muted/50 text-muted-foreground shrink-0 rounded-[2px] border px-2 py-0.5 font-mono text-xs">
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

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        {/* Tabs are DATA now, not markup: ProjectTabsBar measures them to decide
            where the bar runs out of room, and renders whatever doesn't fit on a
            second strip. Order here is the order on screen. */}
        <ProjectTabsBar
          items={[
            { value: "overview", label: "Overview", icon: Layers },
            { value: "brand", label: "Brand", icon: Sparkles },
            { value: "drive", label: "Files", icon: HardDrive },
            { value: "integration", label: "Integration", icon: Plug },
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
              label: "Messages",
              icon: MessageSquare,
              badge: unreadMessages,
            },
            { value: "activity", label: "Activity", icon: Activity },
            { value: "passwords", label: "Passwords", icon: KeyRound },
            // Open to the whole project team. The people who need to know a site
            // is down, or who write the campaigns, are the ones working on it -
            // not only whoever happens to own the project.
            { value: "monitoring", label: "Monitoring", icon: Activity },
            { value: "mailer", label: "Mailer", icon: Mail },
            // Clients STAYS manage-only: it mints portal logins and resets their
            // passwords, which is account administration rather than project work.
            ...(canManage ? [{ value: "clients", label: "Clients", icon: UserCog }] : []),
          ]}
        />

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

          {/* Managers get the whole project; everyone else gets their own slice,
              because "the project is 60% done" is not actionable to someone who
              wants to know what they still owe. */}
          <ProgressOverview projectId={projectRef} currentUserId={userId} isAdmin={canManage} />

          {/* Renders only when the project actually tracks sites. */}
          <ProjectSitesCard projectId={projectRef} onOpenSeo={() => handleTabChange("seo")} />
        </TabsContent>

        <TabsContent value="brand">
          <BrandTab projectId={projectRef} canManage={canManage} />
        </TabsContent>

        <TabsContent value="drive">
          <DriveTab projectId={projectRef} canManage={canManage} />
        </TabsContent>

        <TabsContent value="integration">
          <IntegrationTab projectId={projectRef} canManage={canManage} />
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

        <TabsContent value="passwords" className="mt-4">
          <PasswordsTab projectId={projectRef} currentUserId={userId} canManage={canManage} />
        </TabsContent>

        <TabsContent value="clients" className="mt-4">
          <ProjectClientsTab projectRef={projectRef} canManage={canManage} />
        </TabsContent>

        {/* `canManage` is hardcoded true for these two because reaching this page
            at all already means project access (every read behind it is wrapped
            in withProjectAccess), and both APIs now authorise on exactly that.
            Passing the manager flag instead would render the tab and then hit
            each component's non-manager early return - a tab that opens onto
            nothing. */}
        <TabsContent value="monitoring" className="mt-4">
          <ProjectMonitoringTab projectRef={projectRef} canManage />
        </TabsContent>

        <TabsContent value="mailer" className="mt-4">
          <ProjectMailerTab projectRef={projectRef} canManage />
        </TabsContent>
      </Tabs>

      {/* Edit dialog */}
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
          startDate: project.startDate ? project.startDate.split("T")[0] : "",
          budget: project.budget != null ? String(project.budget) : "",
          accountManagerId: project.owner.id,
        }}
      />
    </div>
  )
}
