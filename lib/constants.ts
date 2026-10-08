export const PERMISSIONS = {
  EMPLOYEE_READ: "employee:read",
  EMPLOYEE_WRITE: "employee:write",
  EMPLOYEE_DELETE: "employee:delete",
  DOCUMENT_READ: "document:read",
  DOCUMENT_WRITE: "document:write",
  DOCUMENT_DELETE: "document:delete",
  ROLE_READ: "role:read",
  ROLE_WRITE: "role:write",
  AUDIT_READ: "audit:read",
  EMAIL_TEMPLATE_READ: "email_template:read",
  EMAIL_TEMPLATE_WRITE: "email_template:write",
  // SMTP, HR inbox, branding - sensitive
  SETTINGS_WRITE: "settings:write",
  DASHBOARD_READ: "dashboard:read",
  ATTENDANCE_READ: "attendance:read",
  ATTENDANCE_WRITE: "attendance:write",
  LEAVE_READ: "leave:read",
  LEAVE_WRITE: "leave:write",
  LEAVE_APPROVE: "leave:approve",
  // Separate from leave:approve so approving leave doesn't imply editing leave policy.
  LEAVE_POLICY: "leave:policy",
  HOLIDAY_WRITE: "holiday:write",
  RESIGNATION_READ: "resignation:read",
  RESIGNATION_APPROVE: "resignation:approve",
  // Separate scopes on purpose: exit:write can deactivate an account.
  ONBOARDING_READ: "onboarding:read",
  ONBOARDING_WRITE: "onboarding:write",
  EXIT_READ: "exit:read",
  EXIT_WRITE: "exit:write",
  WFH_READ: "wfh:read",
  WFH_WRITE: "wfh:write",
  WFH_APPROVE: "wfh:approve",
  PAYROLL_READ: "payroll:read",
  PAYROLL_WRITE: "payroll:write",
  PAYROLL_PROCESS: "payroll:process",
  PROJECT_READ: "project:read",
  PROJECT_WRITE: "project:write",
  PROJECT_DELETE: "project:delete",
  // Separate from project:* so a PM can't necessarily mint client logins or read the client book.
  CLIENT_READ: "client:read",
  CLIENT_WRITE: "client:write",
  PERFORMANCE_READ: "performance:read",
  PERFORMANCE_WRITE: "performance:write",
  PERFORMANCE_REVIEW: "performance:review",
  RECRUITMENT_READ: "recruitment:read",
  RECRUITMENT_WRITE: "recruitment:write",
  ANALYTICS_READ: "analytics:read",

  // No READ scope on purpose: every employee sees announcements and the gallery.
  ANNOUNCEMENT_WRITE: "announcement:write",
  GALLERY_WRITE: "gallery:write",
} as const

export type PermissionScope = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

export const SYSTEM_ROLES = {
  /** Hidden CEO role: never listed in any UI, and its actions skip the audit log. */
  ADMIN_: "admin_",
  ADMIN: "admin",
  HR_MANAGER: "hr_manager",
  HR_EMPLOYEE: "hr_employee",
  EMPLOYEE: "employee",
} as const

export const HIDDEN_ROLES = ["admin_"] as const

// admin_ intentionally omitted.
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
  "company",
  "settings",
  // Audit-log-only modules (no permission scope), listed for the module filter.
  "admin",
  "asc",
  "holiday",
  "resignation",
  "onboarding",
  "exit",
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
    scope: "settings:write",
    module: "settings",
    action: "write",
    description: "Configure integrations and storage",
  },
  {
    scope: "leave:policy",
    module: "leave",
    action: "policy",
    description: "Manage leave types and the entitlement matrix",
  },
  {
    scope: "holiday:write",
    module: "holiday",
    action: "write",
    description: "Manage the company holiday calendar",
  },
  {
    scope: "resignation:read",
    module: "resignation",
    action: "read",
    description: "View resignation requests",
  },
  {
    scope: "resignation:approve",
    module: "resignation",
    action: "approve",
    description: "Review and decide resignation requests",
  },
  {
    scope: "onboarding:read",
    module: "onboarding",
    action: "read",
    description: "View onboarding checklists",
  },
  {
    scope: "onboarding:write",
    module: "onboarding",
    action: "write",
    description: "Run onboarding checklists and edit the onboarding template",
  },
  {
    scope: "exit:read",
    module: "exit",
    action: "read",
    description: "View exit clearance checklists",
  },
  {
    scope: "exit:write",
    module: "exit",
    action: "write",
    description: "Run exit clearances, sign off and issue relieving",
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
    scope: "client:read",
    module: "client",
    action: "read",
    description: "View clients, their projects and portal contacts",
  },
  {
    scope: "client:write",
    module: "client",
    action: "write",
    description: "Create and edit clients, their contacts and portal access",
  },
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
  {
    scope: "announcement:write",
    module: "company",
    action: "write",
    description: "Create, edit, and delete company announcements",
  },
  {
    scope: "gallery:write",
    module: "company",
    action: "write",
    description: "Manage photo gallery albums (create/delete)",
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

/** Fixed height so the list and thread headers meet level at the divider. */
export const SPLIT_PANE_HEADER = "flex h-14 shrink-0 items-center border-b"

/** Fixed height so rows in Chat and project Messages match (one header tall). */
export const SPLIT_PANE_ROW =
  "flex h-14 w-full items-center gap-3 border-b px-3 text-left transition-colors"

/** The one status-pill palette. Every *_COLORS map uses these; add a tone here, not raw classes. */
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

/** Extension fallback for uploads with no MIME type (see lib/upload-rules.ts). */
export const ALLOWED_FILE_EXTENSIONS = [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png", ".webp"]

export const MAX_FILE_SIZE = 20 * 1024 * 1024

// Separate from ALLOWED_FILE_TYPES / MAX_FILE_SIZE, which four document uploads share.

export const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/quicktime", // .mov - what phones and Safari send
  "video/webm",
  "video/x-matroska", // .mkv
  "video/x-msvideo", // .avi
]

/** Browsers often send an empty file.type, so check the extension too. */
export const ALLOWED_VIDEO_EXTENSIONS = [".mp4", ".mov", ".webm", ".mkv", ".avi", ".m4v"]

/** Set by the stack (proxyClientMaxBodySize 260mb, nginx 250M): bigger bodies get truncated, not rejected. */
export const MAX_VIDEO_SIZE = 250 * 1024 * 1024

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

// Deliverable labels live in features/projects/lib/deliverable-lifecycle.ts.

// Grey = nothing yet, blue = moving, amber = stopped, green = exists, red = gone. No shared tones.
export const DELIVERABLE_STATUS_COLORS: Record<string, string> = {
  PLANNED: TONE.neutral,
  IN_PROGRESS: TONE.blue,
  DELIVERED: TONE.green,
  ACCEPTED: TONE.emerald,
  // Orange, not amber, so it can't be confused with STUCK.
  REJECTED: TONE.orange,
  STUCK: TONE.amber,
  DISCARDED: TONE.red,
}

/** Dot versions of the badge colours above, for menus. Keep the two in sync. */
export const DELIVERABLE_STATUS_DOTS: Record<string, string> = {
  PLANNED: "bg-muted-foreground/40",
  IN_PROGRESS: "bg-blue-500",
  DELIVERED: "bg-green-500",
  ACCEPTED: "bg-emerald-500",
  REJECTED: "bg-orange-500",
  STUCK: "bg-amber-500",
  DISCARDED: "bg-red-500",
}

export const CHECKLIST_STATUS_LABELS: Record<string, string> = {
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
}

export const CHECKLIST_STATUS_COLORS: Record<string, string> = {
  IN_PROGRESS: TONE.blue,
  COMPLETED: TONE.green,
  CANCELLED: TONE.neutral,
}

export const CHECKLIST_KIND_LABELS: Record<string, string> = {
  ONBOARDING: "Onboarding",
  EXIT: "Exit clearance",
}

/** Derived, not stored. Overdue is amber, not red: lateness is a nudge, not an error. */
export const CHECKLIST_ITEM_STATE_LABELS: Record<string, string> = {
  DONE: "Done",
  OVERDUE: "Overdue",
  PENDING: "Pending",
}

export const CHECKLIST_ITEM_STATE_COLORS: Record<string, string> = {
  DONE: TONE.green,
  OVERDUE: TONE.amber,
  PENDING: TONE.neutral,
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

/** A project's "Phase": where the client's brand is in its lifecycle. In order. */
export const PROJECT_STAGE_LABELS: Record<string, string> = {
  LAUNCH: "Launch",
  GROWTH: "Growth",
  REBRANDING: "Rebranding",
  DECLINE: "Decline",
}

export const PROJECT_STAGE_COLORS: Record<string, string> = {
  LAUNCH: TONE.blue,
  GROWTH: TONE.green,
  REBRANDING: TONE.purple,
  DECLINE: TONE.orange,
}

export const CLIENT_STATUS_LABELS: Record<string, string> = {
  PROSPECT: "Prospect",
  ACTIVE: "Active",
  INACTIVE: "Inactive",
}

export const CLIENT_STATUS_COLORS: Record<string, string> = {
  PROSPECT: TONE.blue,
  ACTIVE: TONE.green,
  INACTIVE: TONE.neutral,
}

export const TASK_STATUS_LABELS: Record<string, string> = {
  TODO: "To-do",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review", // legacy
  DONE: "Completed",
  CANCELLED: "Cancelled", // legacy
  ON_HOLD: "On Hold",
  DISCARDED: "Discarded",
}

export const REQUIREMENT_TYPE_LABELS: Record<string, string> = {
  DOCUMENT: "Document",
  CREDENTIAL: "Credential",
  ACCESS: "Access",
  CONTENT: "Content",
  DESIGN: "Design",
  APPROVAL: "Approval",
  PAYMENT: "Payment",
  OTHER: "Other",
}

export const REQUIREMENT_STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  PROVIDED: "Provided",
  REJECTED: "Rejected",
  CLOSED: "Closed",
}

export const REQUIREMENT_STATUS_COLORS: Record<string, string> = {
  OPEN: TONE.red,
  IN_PROGRESS: TONE.blue,
  PROVIDED: TONE.green,
  REJECTED: TONE.neutral,
  CLOSED: TONE.neutral,
}

export const REQUIREMENT_OPEN_STATUSES = ["OPEN", "IN_PROGRESS"] as const

export const TASK_STATUS_COLORS: Record<string, string> = {
  TODO: TONE.neutral,
  IN_PROGRESS: TONE.blue,
  IN_REVIEW: TONE.amber, // legacy
  DONE: TONE.green,
  CANCELLED: TONE.neutral, // legacy
  ON_HOLD: TONE.amber,
  DISCARDED: TONE.red,
}

/** In workflow order. Legacy IN_REVIEW / CANCELLED still render but aren't offered. */
export const TASK_WORKFLOW_STATUSES = [
  "TODO",
  "IN_PROGRESS",
  "DONE",
  "ON_HOLD",
  "DISCARDED",
] as const

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

/** The DB stores `isOptional`; callers map it to "FLOATING" / "FIXED". */
export const HOLIDAY_TYPE_LABELS: Record<string, string> = {
  FIXED: "Fixed",
  FLOATING: "Floating",
}

export const HOLIDAY_TYPE_COLORS: Record<string, string> = {
  FIXED: TONE.blue,
  FLOATING: TONE.amber,
}

/** Per employee, per year. */
export const FLOATING_HOLIDAY_LIMIT = 3

/** No CANCELLED on purpose: a withdrawn request shows no pill at all. */
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
