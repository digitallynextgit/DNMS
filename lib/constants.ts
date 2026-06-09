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
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  HR_MANAGER: "hr_manager",
  HR_EMPLOYEE: "hr_employee",
  EMPLOYEE: "employee",
} as const

/** Role names that must never appear in any user-facing listing or selector. */
export const HIDDEN_ROLES = ["super_admin"] as const

/** Role display labels for UIs (super_admin intentionally omitted). */
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

export const EMPLOYEE_STATUS_COLORS: Record<string, string> = {
  ACTIVE:
    "border border-green-200 bg-green-100 text-green-700 dark:border-green-900 dark:bg-green-950/50 dark:text-green-300",
  ON_LEAVE:
    "border border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300",
  SUSPENDED:
    "border border-red-200 bg-red-100 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300",
  RESIGNED:
    "border border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200",
  TERMINATED:
    "border border-red-200 bg-red-100 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300",
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
}

export const ATTENDANCE_STATUS_COLORS: Record<string, string> = {
  PRESENT:
    "border border-green-200 bg-green-100 text-green-700 dark:border-green-900 dark:bg-green-950/50 dark:text-green-300",
  ABSENT:
    "border border-red-200 bg-red-100 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300",
  HALF_DAY:
    "border border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300",
  LATE: "border border-orange-200 bg-orange-100 text-orange-700 dark:border-orange-900 dark:bg-orange-950/50 dark:text-orange-300",
  ON_LEAVE:
    "border border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300",
  HOLIDAY:
    "border border-purple-200 bg-purple-100 text-purple-700 dark:border-purple-900 dark:bg-purple-950/50 dark:text-purple-300",
  WEEKEND:
    "border border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200",
}

export const LEAVE_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
}

export const LEAVE_STATUS_COLORS: Record<string, string> = {
  PENDING:
    "border border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300",
  APPROVED:
    "border border-green-200 bg-green-100 text-green-700 dark:border-green-900 dark:bg-green-950/50 dark:text-green-300",
  REJECTED:
    "border border-red-200 bg-red-100 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300",
  CANCELLED:
    "border border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200",
}

export const PAYROLL_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  PROCESSING: "Processing",
  APPROVED: "Approved",
  PAID: "Paid",
}

export const PAYROLL_STATUS_COLORS: Record<string, string> = {
  DRAFT:
    "border border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200",
  PROCESSING:
    "border border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300",
  APPROVED:
    "border border-green-200 bg-green-100 text-green-700 dark:border-green-900 dark:bg-green-950/50 dark:text-green-300",
  PAID: "border border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300",
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
  PLANNING: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  ACTIVE: "bg-green-500/10 text-green-600 dark:text-green-400",
  ON_HOLD: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  COMPLETED: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  CANCELLED: "bg-muted text-muted-foreground",
}

export const TASK_STATUS_LABELS: Record<string, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review",
  DONE: "Done",
  CANCELLED: "Cancelled",
}

export const TASK_STATUS_COLORS: Record<string, string> = {
  TODO: "bg-muted text-muted-foreground",
  IN_PROGRESS: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  IN_REVIEW: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  DONE: "bg-green-500/10 text-green-600 dark:text-green-400",
  CANCELLED: "bg-red-500/10 text-red-600 dark:text-red-400",
}

export const TASK_PRIORITY_LABELS: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
}

export const TASK_PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-muted text-muted-foreground",
  MEDIUM: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  HIGH: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  URGENT: "bg-red-500/10 text-red-600 dark:text-red-400",
}

export const REVIEW_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  DRAFT: "Draft",
  SELF_REVIEW: "Self Review",
  MANAGER_REVIEW: "Manager Review",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
}

export const REVIEW_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-muted text-muted-foreground",
  DRAFT: "bg-muted text-muted-foreground",
  SELF_REVIEW: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  MANAGER_REVIEW: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  COMPLETED: "bg-green-500/10 text-green-600 dark:text-green-400",
  CANCELLED: "bg-red-500/10 text-red-600 dark:text-red-400",
}

export const GOAL_STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
}

export const GOAL_STATUS_COLORS: Record<string, string> = {
  NOT_STARTED: "bg-muted text-muted-foreground",
  IN_PROGRESS: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  COMPLETED: "bg-green-500/10 text-green-600 dark:text-green-400",
  CANCELLED: "bg-red-500/10 text-red-600 dark:text-red-400",
}

export const JOB_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  OPEN: "Open",
  CLOSED: "Closed",
  ON_HOLD: "On Hold",
}

export const JOB_STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  OPEN: "bg-green-500/10 text-green-600 dark:text-green-400",
  CLOSED: "bg-red-500/10 text-red-600 dark:text-red-400",
  ON_HOLD: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
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
  APPLIED: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  SCREENING: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  INTERVIEW: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  OFFER: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  HIRED: "bg-green-500/10 text-green-600 dark:text-green-400",
  REJECTED: "bg-red-500/10 text-red-600 dark:text-red-400",
}
