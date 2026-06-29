"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Session } from "next-auth"
import {
  LayoutDashboard,
  Users,
  FileText,
  Bell,
  Shield,
  ScrollText,
  Mail,
  ChevronDown,
  Clock,
  CalendarDays,
  DollarSign,
  HelpCircle,
  FolderKanban,
  Star,
  Briefcase,
  BarChart3,
  Laptop,
  Network,
  ListChecks,
  UserMinus,
  Plug,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useSidebarStore } from "@/stores/sidebar-store"
import { PERMISSIONS } from "@/lib/constants"
import { usePendingResignationCount } from "@/features/resignations"
import { useUnreadNotificationCount } from "@/hooks/use-unread-notifications"

interface NavChild {
  label: string
  href: string
  permission?: string
}

interface NavItem {
  label: string
  href?: string
  icon: React.ElementType
  permission?: string
  children?: NavChild[]
  /** Live count badge to render next to the item. */
  badge?: "pending-resignations" | "unread-notifications"
}

// Live count badge shown on the Resignations nav item. Also watches for new
// arrivals (count increases): toasts a notification and refreshes any open
// resignations list so the panel updates without a reload.
function ResignationCountBadge({ collapsed }: { collapsed: boolean }) {
  const router = useRouter()
  const qc = useQueryClient()
  const { data } = usePendingResignationCount()
  const prev = useRef<number | null>(null)

  // Ask once (best-effort) for desktop-notification permission for reviewers.
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {})
    }
  }, [])

  useEffect(() => {
    // Wait for the first real value; the loading state must not seed the
    // baseline, otherwise every reload looks like a 0 -> N "new request".
    if (data === undefined) return

    if (prev.current !== null && prev.current !== data) {
      // Any change - new request, withdrawal, or a decision - refreshes the
      // open resignations panel so it never shows stale rows.
      qc.invalidateQueries({ queryKey: ["resignations-review"] })

      // Only a genuine increase (a new request) notifies.
      if (data > prev.current) {
        const delta = data - prev.current
        const msg = `${delta} new resignation request${delta > 1 ? "s" : ""} to review`
        toast.info(msg, {
          action: { label: "View", onClick: () => router.push("/resignations") },
        })
        if ("Notification" in window && Notification.permission === "granted") {
          const note = new Notification("New resignation request", {
            body: msg,
            icon: "/logo_dark_bg.webp",
          })
          note.onclick = () => {
            window.focus()
            router.push("/resignations")
          }
        }
      }
    }
    prev.current = data
  }, [data, qc, router])

  return <CountBadge collapsed={collapsed} count={data ?? 0} />
}

// Live unread-notification count for the sidebar Notifications item (badge only,
// no toast/desktop notification).
function NotificationCountBadge({ collapsed }: { collapsed: boolean }) {
  const { data: count = 0 } = useUnreadNotificationCount()
  return <CountBadge collapsed={collapsed} count={count} />
}

// Shared presentational red count pill.
function CountBadge({ collapsed, count }: { collapsed: boolean; count: number }) {
  if (count <= 0) return null
  const label = count > 99 ? "99+" : String(count)
  return (
    <span
      className={cn(
        "bg-destructive flex items-center justify-center rounded-full font-semibold text-white",
        collapsed
          ? "absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[9px] leading-none"
          : "ml-auto h-5 min-w-5 px-1.5 text-[11px] leading-none",
      )}
    >
      {label}
    </span>
  )
}

// Dispatch a nav item's badge key to its live-count component.
function NavBadge({
  badge,
  collapsed,
}: {
  badge: NonNullable<NavItem["badge"]>
  collapsed: boolean
}) {
  if (badge === "pending-resignations") return <ResignationCountBadge collapsed={collapsed} />
  return <NotificationCountBadge collapsed={collapsed} />
}

// ── Employee: personal self-service. No permission gate - every signed-in
//    user sees the same set, each a flat link to their own view. ────────────
const EMPLOYEE_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "My Attendance", href: "/attendance/me", icon: Clock },
  { label: "My Leaves", href: "/leave", icon: CalendarDays },
  { label: "My Payslips", href: "/payroll/me", icon: DollarSign },
  { label: "My Performance", href: "/performance/me", icon: Star },
  { label: "Work From Home", href: "/wfh", icon: Laptop },
  { label: "Notifications", href: "/notifications", icon: Bell, badge: "unread-notifications" },
]

// ── Company: shared, company-wide. Visible to everyone. ─────────────────────
const COMPANY_ITEMS: NavItem[] = [
  { label: "Documents", href: "/documents", icon: FileText },
  { label: "Organisation Chart", href: "/employees/org-chart", icon: Network },
  { label: "Help & Guide", href: "/docs", icon: HelpCircle },
]

// ── Project: personal project workspace. Shown to anyone with project access. ─
const PROJECT_ITEMS: NavItem[] = [
  {
    label: "My Projects",
    href: "/projects",
    icon: FolderKanban,
    permission: PERMISSIONS.PROJECT_READ,
  },
  {
    label: "My Tasks",
    href: "/projects/my-tasks",
    icon: ListChecks,
    permission: PERMISSIONS.PROJECT_READ,
  },
]

// ── HRMS: only privileged roles. Gated by manage-level permissions
//    (WRITE/APPROVE/REVIEW) so regular employees never see these groups; they
//    use the flat Employee links above instead. ──────────────────────────────
const HRMS_ITEMS: NavItem[] = [
  {
    label: "Employees",
    icon: Users,
    permission: PERMISSIONS.EMPLOYEE_READ,
    children: [
      { label: "Employee Directory", href: "/employees/employee-directory" },
      { label: "Departments", href: "/employees/departments" },
      { label: "Designations", href: "/employees/designations" },
    ],
  },
  {
    label: "Resignations",
    href: "/resignations",
    icon: UserMinus,
    permission: PERMISSIONS.EMPLOYEE_READ,
    badge: "pending-resignations",
  },
  {
    label: "Attendance",
    icon: Clock,
    permission: PERMISSIONS.ATTENDANCE_WRITE,
    children: [
      { label: "Overview", href: "/attendance" },
      { label: "Devices", href: "/attendance/devices" },
      { label: "Holidays", href: "/attendance/holidays" },
      { label: "Floating Holidays", href: "/attendance/floating-holidays" },
      { label: "Regularization", href: "/attendance/regularizations" },
    ],
  },
  {
    label: "Leave",
    icon: CalendarDays,
    permission: PERMISSIONS.LEAVE_APPROVE,
    children: [
      { label: "Team Leaves", href: "/leave/team" },
      { label: "Leave Calendar", href: "/leave/calendar" },
      { label: "Leave Types", href: "/leave/types" },
    ],
  },
  {
    label: "Work From Home",
    icon: Laptop,
    permission: PERMISSIONS.WFH_APPROVE,
    children: [{ label: "Team WFH", href: "/wfh/team" }],
  },
  {
    label: "Payroll",
    icon: DollarSign,
    permission: PERMISSIONS.PAYROLL_WRITE,
    children: [
      { label: "Overview", href: "/payroll" },
      { label: "Salary Structures", href: "/payroll/salary-structures" },
    ],
  },
  {
    label: "Performance",
    icon: Star,
    permission: PERMISSIONS.PERFORMANCE_REVIEW,
    children: [
      { label: "Reviews", href: "/performance" },
      { label: "Evaluations", href: "/performance/evaluations" },
      { label: "Goals", href: "/performance/goals" },
      { label: "KPIs", href: "/performance/kpis" },
    ],
  },
  {
    label: "Recruitment",
    icon: Briefcase,
    permission: PERMISSIONS.RECRUITMENT_READ,
    children: [{ label: "Careers", href: "/admin/careers" }],
  },
  {
    label: "Analytics",
    href: "/analytics",
    icon: BarChart3,
    permission: PERMISSIONS.ANALYTICS_READ,
  },
]

const ADMIN_ITEMS: NavItem[] = [
  {
    label: "Roles & Permissions",
    href: "/admin/roles",
    icon: Shield,
    permission: PERMISSIONS.ROLE_READ,
  },
  {
    label: "Audit Log",
    href: "/admin/audit-log",
    icon: ScrollText,
    permission: PERMISSIONS.AUDIT_READ,
  },
  {
    label: "Email Templates",
    href: "/admin/email-templates",
    icon: Mail,
    permission: PERMISSIONS.EMAIL_TEMPLATE_READ,
  },
  {
    label: "Project Settings",
    href: "/admin/project-settings",
    icon: FolderKanban,
    permission: PERMISSIONS.PROJECT_WRITE,
  },
  {
    label: "Integrations",
    href: "/admin/integrations",
    icon: Plug,
    permission: PERMISSIONS.SETTINGS_WRITE,
  },
]

function canAccess(item: { permission?: string }, permissions: string[], roles: string[]): boolean {
  if (roles.includes("super_admin")) return true
  if (!item.permission) return true
  return permissions.includes(item.permission)
}

// A nav item is visible if the user can access it AND (for groups) at least one
// child is accessible - otherwise the row would render nothing.
function isItemVisible(item: NavItem, permissions: string[], roles: string[]): boolean {
  if (!canAccess(item, permissions, roles)) return false
  if (item.children) return item.children.some((c) => canAccess(c, permissions, roles))
  return true
}

interface SidebarNavItemProps {
  item: NavItem
  isCollapsed: boolean
  permissions: string[]
  roles: string[]
}

function SidebarNavItem({ item, isCollapsed, permissions, roles }: SidebarNavItemProps) {
  const pathname = usePathname()
  const [open, setOpen] = useState(
    () => item.children?.some((c) => pathname.startsWith(c.href)) ?? false,
  )

  if (!canAccess(item, permissions, roles)) return null

  if (item.children) {
    // Hide individual sub-items the user lacks permission for; hide the whole
    // group if nothing is left visible.
    const visibleChildren = item.children.filter((c) => canAccess(c, permissions, roles))
    if (visibleChildren.length === 0) return null
    const isActive = visibleChildren.some((c) => pathname.startsWith(c.href))

    if (isCollapsed) {
      return (
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "mx-auto flex h-8 w-8 cursor-pointer items-center justify-center rounded transition-colors",
                  isActive
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent",
                )}
              >
                <item.icon className="h-4 w-4" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs font-medium">
              {item.label}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    }

    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            "flex h-8 w-full items-center gap-2.5 rounded px-2.5 text-sm transition-colors",
            isActive
              ? "text-foreground font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-accent",
          )}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">{item.label}</span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 opacity-50 transition-transform duration-150",
              open && "rotate-180",
            )}
          />
        </button>
        {open && (
          <div className="border-border mt-0.5 ml-6.5 space-y-0.5 border-l pl-3">
            {visibleChildren.map((child) => {
              const childActive = pathname === child.href || pathname.startsWith(child.href + "/")
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  className={cn(
                    "block rounded px-2 py-1.5 text-[13px] transition-colors",
                    childActive
                      ? "text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent",
                  )}
                >
                  {child.label}
                </Link>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  const isActive = item.href
    ? pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"))
    : false

  if (isCollapsed) {
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href={item.href!}
              className={cn(
                "relative mx-auto flex h-8 w-8 items-center justify-center rounded transition-colors",
                isActive
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.badge && <NavBadge badge={item.badge} collapsed />}
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs font-medium">
            {item.label}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <Link
      href={item.href!}
      className={cn(
        "flex h-8 items-center gap-2.5 rounded px-2.5 text-sm transition-colors",
        isActive
          ? "bg-accent text-foreground font-medium"
          : "text-muted-foreground hover:text-foreground hover:bg-accent",
      )}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      <span>{item.label}</span>
      {item.badge && <NavBadge badge={item.badge} collapsed={false} />}
    </Link>
  )
}

interface SidebarSectionProps {
  label: string
  items: NavItem[]
  isCollapsed: boolean
  permissions: string[]
  roles: string[]
  first?: boolean
}

// Renders a labelled group of nav items. Hidden entirely if the user can't see
// any item in it. When collapsed, the label is replaced by a thin divider
// (except for the first section, which sits flush under the logo).
function SidebarSection({
  label,
  items,
  isCollapsed,
  permissions,
  roles,
  first,
}: SidebarSectionProps) {
  if (!items.some((item) => isItemVisible(item, permissions, roles))) return null

  return (
    <>
      {isCollapsed
        ? !first && <div className="border-border mx-1 my-2 border-t" />
        : !first && <div aria-hidden className="h-2" />}
      {!isCollapsed && (
        <p className="text-muted-foreground px-2.5 pb-1 text-[10px] font-medium tracking-widest uppercase">
          {label}
        </p>
      )}
      {items.map((item) => (
        <SidebarNavItem
          key={item.label}
          item={item}
          isCollapsed={isCollapsed}
          permissions={permissions}
          roles={roles}
        />
      ))}
    </>
  )
}

export function Sidebar({ session }: { session: Session }) {
  const { isCollapsed, toggle } = useSidebarStore()
  const permissions = session.user.permissions
  const roles = session.user.roles

  // Ctrl+B (Windows/Linux) and Cmd+B (macOS) toggle the sidebar.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "b") {
        const target = e.target as HTMLElement | null
        const tag = target?.tagName
        const isEditable =
          tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable
        if (isEditable) return
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [toggle])

  return (
    <aside
      className={cn(
        "bg-background border-border flex h-full min-h-0 shrink-0 flex-col border-r transition-all duration-200",
        isCollapsed ? "w-14" : "w-56",
      )}
    >
      {/* Logo - theme-aware wordmark. Light mode shows the black-text logo,
          dark / custom themes show the white-text one. On the collapsed rail the
          row is clipped so only the left X mark shows. */}
      <div
        className={cn(
          "border-border flex h-14.25 shrink-0 items-center overflow-hidden border-b",
          isCollapsed ? "justify-center px-2" : "px-4",
        )}
      >
        <div className={cn("flex items-center overflow-hidden", isCollapsed ? "w-9" : "w-auto")}>
          {/* Light mode → black-text logo */}
          <Image
            src="/logo_white_bg.png"
            alt="Digitally Next"
            width={4500}
            height={1167}
            priority
            className="h-10 w-auto max-w-none dark:hidden"
          />
          {/* Dark / custom themes → white-text logo */}
          <Image
            src="/logo_dark_bg.webp"
            alt="Digitally Next"
            width={4500}
            height={1167}
            priority
            className="hidden h-10 w-auto max-w-none dark:block"
          />
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        <SidebarSection
          label="Employee"
          items={EMPLOYEE_ITEMS}
          isCollapsed={isCollapsed}
          permissions={permissions}
          roles={roles}
          first
        />
        <SidebarSection
          label="HRMS"
          items={HRMS_ITEMS}
          isCollapsed={isCollapsed}
          permissions={permissions}
          roles={roles}
        />
        <SidebarSection
          label="Project"
          items={PROJECT_ITEMS}
          isCollapsed={isCollapsed}
          permissions={permissions}
          roles={roles}
        />
        <SidebarSection
          label="Admin"
          items={ADMIN_ITEMS}
          isCollapsed={isCollapsed}
          permissions={permissions}
          roles={roles}
        />
        <SidebarSection
          label="Company"
          items={COMPANY_ITEMS}
          isCollapsed={isCollapsed}
          permissions={permissions}
          roles={roles}
        />
      </nav>
    </aside>
  )
}
