// =============================================================================
// The roles every tenant starts with (M5).
//
// Extracted from prisma/seed.ts so that provisioning a NEW company and seeding a
// fresh database create the same five roles with the same grants. They were the
// same list written twice before this existed, which is how the second copy
// quietly falls behind the first.
//
// Roles and role_permissions are TENANT-SCOPED - each company owns its own copy
// and may edit them. `permissions` (the 39 scopes) are platform-level and shared,
// because a scope is a fact about what the software can do, not about a customer.
//
// No framework or server imports: prisma/seed.ts runs standalone with its own
// client, and features/tenants/ runs inside the app.
// =============================================================================

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
      // Company noticeboard management (announcements + gallery albums).
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
      // Self-service: an HR employee is still an employee who applies for their
      // own leave/WFH/self-assessment and views their own payslips.
      // payroll:read is self-scoped by the route (non payroll:write callers see
      // only their own records), so it grants payslip access without exposing
      // anyone else's pay.
      "leave:write",
      "leave:approve",
      "wfh:read",
      "wfh:write",
      "wfh:approve",
      "payroll:read",
      "performance:read",
      "performance:write",
      "resignation:read",
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

/** The role the first person in a new company gets. */
export const FOUNDER_ROLE = "admin"

/** The role every subsequent hire gets by default. */
export const DEFAULT_ROLE = "employee"
