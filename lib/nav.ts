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
  CalendarRange,
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
  UserPlus,
  Megaphone,
  Images,
  MessageSquare,
  Building2,
  ClipboardCheck,
  DoorOpen,
  Package,
  Presentation,
  Bot,
  LifeBuoy,
  Wrench,
} from "lucide-react"

import { PERMISSIONS } from "@/lib/constants"

// The one nav list, shared by the desktop sidebar and the mobile tab bar / More menu.

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
  badge?: "pending-resignations" | "unread-notifications" | "unread-chat" | "pending-clearances"
}

// Self-service links with no permission gate: every user sees their own view.
export const EMPLOYEE_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "My Attendance", href: "/attendance/me", icon: Clock },
  { label: "My Leave", href: "/leave", icon: CalendarDays },
  { label: "My Payslips", href: "/payroll/me", icon: DollarSign },
  { label: "My Performance", href: "/performance/me", icon: Star },
  { label: "Work From Home", href: "/wfh", icon: Laptop },
  { label: "Calendar", href: "/calendar", icon: CalendarRange },
  { label: "My Referrals", href: "/referrals", icon: UserPlus },
  // Ungated on purpose: Finance/IT heads hold no HR scope. Hides itself when empty.
  {
    label: "Waiting on you",
    href: "/clearances",
    icon: ClipboardCheck,
    badge: "pending-clearances",
  },
  { label: "Notifications", href: "/notifications", icon: Bell, badge: "unread-notifications" },
  // The AI only ever gets the connecting person's own permissions.
  { label: "AI Connections", href: "/ai-connections", icon: Bot },
]

export const COMPANY_ITEMS: NavItem[] = [
  { label: "Chat", href: "/chat", icon: MessageSquare, badge: "unread-chat" },
  { label: "Announcements", href: "/announcements", icon: Megaphone },
  { label: "Photo Gallery", href: "/gallery", icon: Images },
  { label: "Documents", href: "/documents", icon: FileText },
  { label: "Organisation Chart", href: "/employees/org-chart", icon: Network },
  // A single tool can still be limited by permission.
  { label: "Tools", href: "/tools", icon: Wrench },
  // Each reader only sees guides for pages in their own sidebar.
  { label: "Help & Guides", href: "/help", icon: LifeBuoy },
]

const PROJECT_ITEMS: NavItem[] = [
  // No gate: the pages are scoped to the user's own (owned + member) projects.
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

/** The progress label says what the reader actually gets (the page is scoped server-side). */
export function projectItems(canManageProjects: boolean): NavItem[] {
  return [
    ...PROJECT_ITEMS,
    {
      label: canManageProjects ? "Progress" : "My Progress",
      href: "/projects/progress",
      icon: TrendingUp,
    },
    // No gate: the route scopes it to self, a manager's reports, or (admin/HR) anyone.
    { label: "Work Report", href: "/work-reports", icon: Presentation },
    {
      label: "Clients",
      href: "/projects/clients",
      icon: Building2,
      permission: PERMISSIONS.CLIENT_READ,
    },
  ]
}

// Manage-level permissions only; regular employees use the Employee links above.
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
    label: "Onboarding",
    href: "/onboarding",
    icon: ClipboardCheck,
    permission: PERMISSIONS.ONBOARDING_WRITE,
  },
  {
    label: "Exit Clearance",
    href: "/exit-clearance",
    icon: DoorOpen,
    permission: PERMISSIONS.EXIT_READ,
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
    label: "Calendar",
    href: "/holidays",
    icon: CalendarRange,
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
    label: "Stock Register",
    href: "/stock",
    icon: Package,
    permission: PERMISSIONS.EMPLOYEE_READ,
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

// Groups also need at least one visible child, or the row would be empty.
export function isItemVisible(item: NavItem, permissions: string[], roles: string[]): boolean {
  if (!canAccess(item, permissions, roles)) return false
  if (item.children) return item.children.some((c) => canAccess(c, permissions, roles))
  return true
}
