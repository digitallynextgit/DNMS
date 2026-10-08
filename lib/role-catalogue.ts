// Starting roles for every tenant, shared by prisma/seed.ts and new-company provisioning.
// Roles are per-tenant and editable; permission scopes are platform-wide. No framework imports.

export interface RoleDefinition {
  name: string
  displayName: string
  description: string
  isSystem: boolean
  /** "ALL" grants every scope in the catalogue. */
  permissions: "ALL" | readonly string[]
}

export const ROLE_CATALOGUE: readonly RoleDefinition[] = [
  {
    name: "admin_",
    displayName: "Admin_",
    description: "CEO-only role. Hidden from every UI listing. Full system access.",
    isSystem: true,
    permissions: "ALL",
  },
  {
    name: "admin",
    displayName: "Admin",
    description: "Full system access and permissions",
    isSystem: true,
    permissions: "ALL",
  },
  {
    name: "hr_manager",
    displayName: "HR Manager",
    description: "Full HR access across all modules",
    isSystem: true,
    permissions: [
      "employee:read",
      "employee:write",
      "employee:delete",
      "document:read",
      "document:write",
      "document:delete",
      "dashboard:read",
      "attendance:read",
      "attendance:write",
      "leave:read",
      "leave:write",
      "leave:approve",
      "leave:policy",
      "holiday:write",
      "resignation:read",
      "resignation:approve",
      // Includes the exit sign-off that closes the account.
      "onboarding:read",
      "onboarding:write",
      "exit:read",
      "exit:write",
      "wfh:read",
      "wfh:write",
      "wfh:approve",
      "payroll:read",
      "payroll:write",
      "payroll:process",
      "performance:read",
      "performance:write",
      "performance:review",
      "recruitment:read",
      "recruitment:write",
      "analytics:read",
      "email_template:read",
      "email_template:write",
      "project:read",
      "project:write",
      "project:delete",
      "audit:read",
      "announcement:write",
      "gallery:write",
    ],
  },
  {
    name: "hr_employee",
    displayName: "HR Employee",
    description: "HR access with limited scope (no payroll administration)",
    isSystem: true,
    permissions: [
      "employee:read",
      "document:read",
      "document:write",
      "dashboard:read",
      "attendance:read",
      "leave:read",
      // Self-service. payroll:read is self-scoped by the route, so it only shows their own payslips.
      "leave:write",
      "leave:approve",
      "wfh:read",
      "wfh:write",
      "wfh:approve",
      "payroll:read",
      "performance:read",
      "performance:write",
      "resignation:read",
      // Read-only: running an exit (which deactivates the account) stays with hr_manager.
      "onboarding:read",
      "exit:read",
      "recruitment:read",
      "recruitment:write",
    ],
  },
  {
    name: "employee",
    displayName: "Employee",
    description: "Self-service access for own profile, leave, attendance, payslips",
    isSystem: true,
    permissions: [
      "dashboard:read",
      "attendance:read",
      "leave:read",
      "leave:write",
      "wfh:read",
      "wfh:write",
      "payroll:read",
      "document:read",
      "performance:read",
      "performance:write",
      "project:read",
    ],
  },
] as const

export const FOUNDER_ROLE = "admin"

export const DEFAULT_ROLE = "employee"
