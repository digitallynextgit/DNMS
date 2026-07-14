export const PERMISSIONS = {
  // Employee
  EMPLOYEE_READ: "employee:read",
  EMPLOYEE_WRITE: "employee:write",
  EMPLOYEE_DELETE: "employee:delete",
  // Document
  DOCUMENT_READ: "document:read",
  DOCUMENT_WRITE: "document:write",
  DOCUMENT_DELETE: "document:delete",
  // Role/PBAC
  ROLE_READ: "role:read",
  ROLE_WRITE: "role:write",
  // Audit
  AUDIT_READ: "audit:read",
  // Email templates
  EMAIL_TEMPLATE_READ: "email_template:read",
  EMAIL_TEMPLATE_WRITE: "email_template:write",
  // Integrations / app settings (SMTP, HR inbox, branding) - sensitive
  SETTINGS_WRITE: "settings:write",
  // Dashboard
  DASHBOARD_READ: "dashboard:read",
  // Attendance
  ATTENDANCE_READ: "attendance:read",
  ATTENDANCE_WRITE: "attendance:write",
  // Leave
  LEAVE_READ: "leave:read",
  LEAVE_WRITE: "leave:write",
  LEAVE_APPROVE: "leave:approve",
  // Work From Home
  WFH_READ: "wfh:read",
  WFH_WRITE: "wfh:write",
  WFH_APPROVE: "wfh:approve",
  // Payroll
  PAYROLL_READ: "payroll:read",
  PAYROLL_WRITE: "payroll:write",
  PAYROLL_PROCESS: "payroll:process",
  // Projects
  PROJECT_READ: "project:read",
  PROJECT_WRITE: "project:write",
  PROJECT_DELETE: "project:delete",
  // Performance
  PERFORMANCE_READ: "performance:read",
  PERFORMANCE_WRITE: "performance:write",
  PERFORMANCE_REVIEW: "performance:review",
  // Recruitment
  RECRUITMENT_READ: "recruitment:read",
  RECRUITMENT_WRITE: "recruitment:write",
  // Analytics
  ANALYTICS_READ: "analytics:read",
} as const

export type PermissionScope = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

export const SYSTEM_ROLES = {
  /** Hidden role reserved for the CEO. Never shown in any UI listing or
   *  dropdown, and actions performed by accounts with this role are not
   *  written to the audit log. */
  ADMIN_: "admin_",
  ADMIN: "admin",
  HR_MANAGER: "hr_manager",
  HR_EMPLOYEE: "hr_employee",
  EMPLOYEE: "employee",
} as const

/** Role names that must never appear in any user-facing listing or selector. */
export const HIDDEN_ROLES = ["admin_"] as const

/** Role display labels for UIs (admin_ intentionally omitted). */
export const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  hr_manager: "HR Manager",
  hr_employee: "HR Employee",
  employee: "Employee",
}

export const MODULES = [
  "employee",
  "document",
  "role",
  "audit",
  "email_template",
  "dashboard",
  "auth",
  "attendance",
  "leave",
  "wfh",
  "payroll",
  "project",
  "performance",
  "recruitment",
  "analytics",
] as const

export const PERMISSION_DEFINITIONS = [
  {
    scope: "employee:read",
    module: "employee",
    action: "read",
    description: "View employee profiles and directory",
  },
  {
    scope: "employee:write",
    module: "employee",
    action: "write",
    description: "Create and edit employees",
  },
  {
    scope: "employee:delete",
    module: "employee",
    action: "delete",
    description: "Delete or deactivate employees",
  },
  {
    scope: "document:read",
    module: "document",
    action: "read",
    description: "View and download documents",
  },
  { scope: "document:write", module: "document", action: "write", description: "Upload documents" },
  {
    scope: "document:delete",
    module: "document",
    action: "delete",
    description: "Delete documents",
  },
  {
    scope: "role:read",
    module: "role",
    action: "read",
    description: "View roles and permission matrix",
  },
  {
    scope: "role:write",
    module: "role",
    action: "write",
    description: "Create, edit, and assign roles",
  },
  { scope: "audit:read", module: "audit", action: "read", description: "View audit logs" },
  {
    scope: "email_template:read",
    module: "email_template",
    action: "read",
    description: "View email templates",
  },
  {
    scope: "email_template:write",
    module: "email_template",
    action: "write",
    description: "Create and edit email templates",
  },
  {
    scope: "dashboard:read",
    module: "dashboard",
    action: "read",
    description: "View dashboard statistics",
  },
  {
    scope: "attendance:read",
    module: "attendance",
    action: "read",
    description: "View attendance records",
  },
  {
    scope: "attendance:write",
    module: "attendance",
    action: "write",
    description: "Create and edit attendance records",
  },
  {
    scope: "leave:read",
    module: "leave",
    action: "read",
    description: "View leave requests and balances",
  },
  { scope: "leave:write", module: "leave", action: "write", description: "Apply for leave" },
  {
    scope: "leave:approve",
    module: "leave",
    action: "approve",
    description: "Approve or reject leave requests",
  },
  { scope: "wfh:read", module: "wfh", action: "read", description: "View work-from-home requests" },
  { scope: "wfh:write", module: "wfh", action: "write", description: "Apply for work-from-home" },
  {
    scope: "wfh:approve",
    module: "wfh",
    action: "approve",
    description: "Approve or reject WFH requests",
  },
  {
    scope: "payroll:read",
    module: "payroll",
    action: "read",
    description: "View payroll records and payslips",
  },
  {
    scope: "payroll:write",
    module: "payroll",
    action: "write",
    description: "Create and edit salary structures",
  },
  {
    scope: "payroll:process",
    module: "payroll",
    action: "process",
    description: "Process and approve payroll runs",
  },
  {
    scope: "project:read",
    module: "project",
    action: "read",
    description: "View projects and tasks",
  },
  {
    scope: "project:write",
    module: "project",
    action: "write",
    description: "Create and edit projects and tasks",
  },
  { scope: "project:delete", module: "project", action: "delete", description: "Delete projects" },
  {
    scope: "performance:read",
    module: "performance",
    action: "read",
    description: "View performance reviews",
  },
  {
    scope: "performance:write",
    module: "performance",
    action: "write",
    description: "Submit self-assessment and goals",
  },
  {
    scope: "performance:review",
    module: "performance",
    action: "review",
    description: "Conduct manager reviews",
  },
  {
    scope: "recruitment:read",
    module: "recruitment",
    action: "read",
    description: "View job postings and applicants",
  },
  {
    scope: "recruitment:write",
    module: "recruitment",
    action: "write",
    description: "Manage job postings and applicants",
  },
  {
    scope: "analytics:read",
    module: "analytics",
    action: "read",
    description: "View analytics and reports",
  },
] as const

export const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  FULL_TIME: "Full Time",
  PART_TIME: "Part Time",
  CONTRACT: "Contract",
  INTERN: "Intern",
}

export const EMPLOYEE_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  ON_LEAVE: "On Leave",
  SUSPENDED: "Suspended",
  RESIGNED: "Resigned",
  TERMINATED: "Terminated",
}

/**
 * ─── The status-pill palette ────────────────────────────────────────────────
 * ONE formula for every status colour in the app. Previously there were FIVE
 * competing families (bordered+opaque, borderless+alpha, emerald-500/30, ...),
 * so an amber "PENDING" leave pill and an amber "ON_HOLD" project pill looked
 * nothing alike on adjacent pages.
 *
 * This is the borderless/alpha family: the /10 tint works on any background and
 * needs only a text override in dark mode - no per-shade dark bg/border to keep
 * in sync. Every *_COLORS map below is built from these tones. Add a tone here
 * rather than writing raw classes in a map.
 */
export const TONE = {
  green: "bg-green-500/10 text-green-600 dark:text-green-400",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  orange: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  red: "bg-red-500/10 text-red-600 dark:text-red-400",
  purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  neutral: "bg-muted text-muted-foreground",
} as const

export const EMPLOYEE_STATUS_COLORS: Record<string, string> = {
  ACTIVE: TONE.green,
  ON_LEAVE: TONE.amber,
  SUSPENDED: TONE.red,
  RESIGNED: TONE.neutral,
  TERMINATED: TONE.red,
}

export const DOCUMENT_CATEGORY_LABELS: Record<string, string> = {
  IDENTITY: "Identity",
  ACADEMIC: "Academic",
  PROFESSIONAL: "Professional",
  EMPLOYMENT: "Employment",
  TAX: "Tax",
  COMPANY_POLICY: "Company Policy",
  TEMPLATE: "Template",
  OTHER: "Other",
}

export const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]

export const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB

export const ATTENDANCE_STATUS_LABELS: Record<string, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  HALF_DAY: "Half Day",
  LATE: "Late",
  ON_LEAVE: "On Leave",
  HOLIDAY: "Holiday",
  WEEKEND: "Weekend",
  MISSING_PUNCH: "Missing punch",
}

/** Active / inactive pill - used for devices, employees, holidays, roles… */
export const ACTIVE_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
}

export const ATTENDANCE_STATUS_COLORS: Record<string, string> = {
  PRESENT: TONE.green,
  ABSENT: TONE.red,
  HALF_DAY: TONE.amber,
  LATE: TONE.orange,
  ON_LEAVE: TONE.blue,
  HOLIDAY: TONE.purple,
  WEEKEND: TONE.neutral,
  MISSING_PUNCH: TONE.purple,
}

export const ACTIVE_STATUS_COLORS: Record<string, string> = {
  ACTIVE: TONE.green,
  INACTIVE: TONE.neutral,
}

export const LEAVE_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
}

export const LEAVE_STATUS_COLORS: Record<string, string> = {
  PENDING: TONE.amber,
  APPROVED: TONE.green,
  REJECTED: TONE.red,
  CANCELLED: TONE.neutral,
}

export const PAYROLL_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  PROCESSING: "Processing",
  APPROVED: "Approved",
  PAID: "Paid",
}

export const PAYROLL_STATUS_COLORS: Record<string, string> = {
  DRAFT: TONE.neutral,
  PROCESSING: TONE.blue,
  APPROVED: TONE.green,
  PAID: TONE.emerald,
}

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  PLANNING: "Planning",
  ACTIVE: "Active",
  ON_HOLD: "On Hold",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
}

export const PROJECT_STATUS_COLORS: Record<string, string> = {
  PLANNING: TONE.blue,
  ACTIVE: TONE.green,
  ON_HOLD: TONE.amber,
  COMPLETED: TONE.purple,
  CANCELLED: TONE.neutral,
}

export const TASK_STATUS_LABELS: Record<string, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review",
  DONE: "Done",
  CANCELLED: "Cancelled",
}

export const TASK_STATUS_COLORS: Record<string, string> = {
  TODO: TONE.neutral,
  IN_PROGRESS: TONE.blue,
  IN_REVIEW: TONE.amber,
  DONE: TONE.green,
  CANCELLED: TONE.neutral,
}

export const TASK_PRIORITY_LABELS: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
}

export const TASK_PRIORITY_COLORS: Record<string, string> = {
  LOW: TONE.neutral,
  MEDIUM: TONE.blue,
  HIGH: TONE.amber,
  URGENT: TONE.red,
}

export const JOB_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  OPEN: "Open",
  CLOSED: "Closed",
  ON_HOLD: "On Hold",
}

export const JOB_STATUS_COLORS: Record<string, string> = {
  DRAFT: TONE.neutral,
  OPEN: TONE.green,
  CLOSED: TONE.red,
  ON_HOLD: TONE.amber,
}

export const APPLICANT_STAGE_LABELS: Record<string, string> = {
  APPLIED: "Applied",
  SCREENING: "Screening",
  INTERVIEW: "Interview",
  OFFER: "Offer",
  HIRED: "Hired",
  REJECTED: "Rejected",
}

export const APPLICANT_STAGE_COLORS: Record<string, string> = {
  APPLIED: TONE.blue,
  SCREENING: TONE.amber,
  INTERVIEW: TONE.purple,
  OFFER: TONE.orange,
  HIRED: TONE.green,
  REJECTED: TONE.red,
}

// ─── Centralized maps (were previously duplicated/inline in pages) ──────────

export const EVALUATION_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  SELF_DONE: "Self done",
  MANAGER_DONE: "Manager done",
  COMPLETED: "Completed",
}

/** Whether an employee has a custom KPI profile, or falls back to the sheet defaults. */
export const KPI_PROFILE_STATUS_LABELS: Record<string, string> = {
  CONFIGURED: "Configured",
  DEFAULT: "Using defaults",
}

export const KPI_PROFILE_STATUS_COLORS: Record<string, string> = {
  CONFIGURED: TONE.green,
  DEFAULT: TONE.neutral,
}

export const EVALUATION_STATUS_COLORS: Record<string, string> = {
  PENDING: TONE.amber,
  SELF_DONE: TONE.blue,
  MANAGER_DONE: TONE.blue,
  COMPLETED: TONE.green,
}

/** Single amber pill for the "on probation" flag (unifies 4 hand-copied variants). */
export const PROBATION_BADGE = TONE.amber

export const DOC_ROLE_LABELS: Record<string, string> = {
  employee: "Employee",
  manager: "Manager",
  hr: "HR",
  admin: "Admin",
}

export const DOC_ROLE_COLORS: Record<string, string> = {
  employee: TONE.blue,
  manager: TONE.purple,
  hr: TONE.emerald,
  admin: TONE.red,
}

export const RESOURCE_CATEGORY_COLORS: Record<string, string> = {
  BRIEFS: TONE.blue,
  ASSETS: TONE.purple,
  DELIVERABLES: TONE.emerald,
  REFERENCES: TONE.amber,
  OTHER: TONE.neutral,
}

/**
 * Holiday type pill. The DB models this as `isOptional: boolean`, so callers map
 * `h.isOptional ? "FLOATING" : "FIXED"` before handing it to <StatusBadge>.
 */
export const HOLIDAY_TYPE_LABELS: Record<string, string> = {
  FIXED: "Fixed",
  FLOATING: "Floating",
}

export const HOLIDAY_TYPE_COLORS: Record<string, string> = {
  FIXED: TONE.blue,
  FLOATING: TONE.amber,
}

/**
 * Status of an employee's floating-holiday request.
 * CANCELLED is deliberately absent: a withdrawn request shows no pill at all
 * (the cell falls back to "-"), exactly as if the employee had never applied.
 */
export const FLOATING_REQUEST_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
}

export const FLOATING_REQUEST_STATUS_COLORS: Record<string, string> = {
  PENDING: TONE.amber,
  APPROVED: TONE.green,
  REJECTED: TONE.red,
}

/** Status of a post in a project's content calendar (Brand tab). */
export const CONTENT_CALENDAR_STATUS_LABELS: Record<string, string> = {
  PLANNED: "Planned",
  IN_PROGRESS: "In progress",
  READY: "Ready",
  POSTED: "Posted",
}

export const CONTENT_CALENDAR_STATUS_COLORS: Record<string, string> = {
  PLANNED: TONE.neutral,
  IN_PROGRESS: TONE.amber,
  READY: TONE.blue,
  POSTED: TONE.green,
}
