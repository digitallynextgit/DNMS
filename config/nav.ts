import {
  LayoutDashboard,
  Users,
  FileText,
  Bell,
  Shield,
  ScrollText,
  Mail,
  Clock,
  CalendarDays,
  DollarSign,
  FolderKanban,
  TrendingUp,
  Star,
  Briefcase,
  BarChart3,
  Laptop,
  Network,
  ListChecks,
  UserMinus,
  Plug,
  HardDrive,
  PartyPopper,
  UserPlus,
  Megaphone,
  Images,
  MessageSquare,
  Building2,
} from "lucide-react"

import { PERMISSIONS } from "@/lib/constants"

/**
 * The single source of truth for app navigation, shared by the desktop sidebar
 * (components/layout/sidebar.tsx) and the mobile shell (bottom tab bar + the
 * "More" menu). Keeping one list means a new module or a permission change is
 * made once and both shells follow.
 */

export interface NavChild {
  label: string
  href: string
  permission?: string
}

export interface NavItem {
  label: string
  href?: string
  icon: React.ElementType
  permission?: string
  children?: NavChild[]
  /** Live count badge to render next to the item. */
  badge?: "pending-resignations" | "unread-notifications" | "unread-chat"
}

// ── Employee: personal self-service. No permission gate - every signed-in
//    user sees the same set, each a flat link to their own view. ────────────
export const EMPLOYEE_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "My Attendance", href: "/attendance/me", icon: Clock },
  { label: "My Leave", href: "/leave", icon: CalendarDays },
  { label: "My Payslips", href: "/payroll/me", icon: DollarSign },
  { label: "My Performance", href: "/performance/me", icon: Star },
  { label: "Work From Home", href: "/wfh", icon: Laptop },
  { label: "Holiday Calendar", href: "/holiday-calendar", icon: PartyPopper },
  // No permission gate: referring somebody is open to every employee, and the
  // page only ever shows the caller's own referrals.
  { label: "My Referrals", href: "/referrals", icon: UserPlus },
  { label: "Notifications", href: "/notifications", icon: Bell, badge: "unread-notifications" },
]

// ── Company: shared, company-wide. Visible to everyone. ─────────────────────
export const COMPANY_ITEMS: NavItem[] = [
  { label: "Chat", href: "/chat", icon: MessageSquare, badge: "unread-chat" },
  { label: "Announcements", href: "/announcements", icon: Megaphone },
  { label: "Photo Gallery", href: "/gallery", icon: Images },
  { label: "Documents", href: "/documents", icon: FileText },
  { label: "Organisation Chart", href: "/employees/org-chart", icon: Network },
]

// ── Project: personal project workspace. Shown to anyone with project access. ─
const PROJECT_ITEMS: NavItem[] = [
  // No permission gate: everyone gets a personal project workspace. The pages are
  // scoped to the user's own (owned + member) projects, so a non-participant just
  // sees an empty list - and an account manager who is a plain employee can reach
  // the projects they own.
  {
    label: "My Projects",
    href: "/projects/my-projects",
    icon: FolderKanban,
  },
  {
    label: "My Tasks",
    href: "/projects/my-tasks",
    icon: ListChecks,
  },
]

/**
 * Project links, with the progress entry named for who is reading it.
 *
 * The page behind it is already scoped server-side: `project:write` holders see
 * every project, everyone else sees the teams they manage, the projects they
 * own, and their own tasks. The label should say which of those you are getting
 * rather than promising a company-wide view to someone who cannot have one.
 */
export function projectItems(canManageProjects: boolean): NavItem[] {
  return [
    ...PROJECT_ITEMS,
    {
      label: canManageProjects ? "Progress" : "My Progress",
      href: "/projects/progress",
      icon: TrendingUp,
    },
    // The company book: who the projects are for, with their contacts and
    // portal access. Gated on its own scope rather than project:write, because
    // running projects and administering client logins are different jobs.
    {
      label: "Clients",
      href: "/projects/clients",
      icon: Building2,
      permission: PERMISSIONS.CLIENT_READ,
    },
  ]
}

// ── HRMS: only privileged roles. Gated by manage-level permissions
//    (WRITE/APPROVE/REVIEW) so regular employees never see these groups; they
//    use the flat Employee links above instead. ──────────────────────────────
export const HRMS_ITEMS: NavItem[] = [
  {
    label: "Employees",
    icon: Users,
    permission: PERMISSIONS.EMPLOYEE_READ,
    children: [
      { label: "Employee Directory", href: "/employees/employee-directory" },
      { label: "Departments", href: "/employees/departments" },
      { label: "Designations", href: "/employees/designations" },
      { label: "Job Roles", href: "/employees/job-roles" },
    ],
  },
  {
    label: "Resignations",
    href: "/resignations",
    icon: UserMinus,
    permission: PERMISSIONS.RESIGNATION_READ,
    badge: "pending-resignations",
  },
  {
    label: "Attendance",
    icon: Clock,
    permission: PERMISSIONS.ATTENDANCE_WRITE,
    children: [
      { label: "Attendance Directory", href: "/attendance/attendance-directory" },
      { label: "Devices", href: "/attendance/devices" },
    ],
  },
  {
    label: "Holiday Calendar",
    href: "/holidays",
    icon: PartyPopper,
    permission: PERMISSIONS.HOLIDAY_WRITE,
  },
  {
    label: "Leave",
    icon: CalendarDays,
    permission: PERMISSIONS.LEAVE_APPROVE,
    children: [
      { label: "Leave Directory", href: "/leave/leave-directory" },
      { label: "Leave Types & Policy", href: "/leave/types" },
    ],
  },
  {
    label: "Work From Home",
    href: "/wfh/requests",
    icon: Laptop,
    permission: PERMISSIONS.WFH_APPROVE,
  },
  {
    label: "Payroll",
    icon: DollarSign,
    permission: PERMISSIONS.PAYROLL_WRITE,
    children: [
      { label: "Payroll Directory", href: "/payroll/payroll-directory" },
      { label: "Salary Structures", href: "/payroll/salary-structures" },
    ],
  },
  {
    label: "Performance",
    icon: Star,
    permission: PERMISSIONS.PERFORMANCE_REVIEW,
    children: [
      { label: "Evaluations", href: "/performance/evaluations" },
      { label: "KPI Profiles", href: "/performance/kpi-profiles" },
    ],
  },
  {
    label: "Recruitment",
    icon: Briefcase,
    permission: PERMISSIONS.RECRUITMENT_READ,
    children: [
      { label: "Careers", href: "/admin/careers" },
      { label: "Applications", href: "/recruitment/applications" },
      { label: "Referrals", href: "/admin/referrals" },
    ],
  },
  {
    label: "Analytics",
    href: "/analytics",
    icon: BarChart3,
    permission: PERMISSIONS.ANALYTICS_READ,
  },
]

export const ADMIN_ITEMS: NavItem[] = [
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
    label: "Integrations",
    href: "/admin/integrations",
    icon: Plug,
    permission: PERMISSIONS.SETTINGS_WRITE,
  },
  {
    label: "Storage",
    href: "/admin/storage",
    icon: HardDrive,
    permission: PERMISSIONS.SETTINGS_WRITE,
  },
]

export function canAccess(
  item: { permission?: string },
  permissions: string[],
  roles: string[],
): boolean {
  if (roles.includes("admin_")) return true
  if (!item.permission) return true
  return permissions.includes(item.permission)
}

// A nav item is visible if the user can access it AND (for groups) at least one
// child is accessible - otherwise the row would render nothing.
export function isItemVisible(item: NavItem, permissions: string[], roles: string[]): boolean {
  if (!canAccess(item, permissions, roles)) return false
  if (item.children) return item.children.some((c) => canAccess(c, permissions, roles))
  return true
}
