// =============================================================================
// Snapshot config - shared by export-snapshot.ts and seed-snapshot.ts
// =============================================================================
// Raw-SQL backup/restore that is immune to schema drift (it never touches the
// Prisma schema - only the live DB columns).
//
// SNAPSHOT_TABLES lists every table in foreign-key dependency order (parents
// first). Export ignores the order; restore INSERTs in this order and DELETEs
// in reverse so FK constraints are always satisfied.
//
// DEFERRED_FIELDS are self-referential / circular FKs (snake_case columns) that
// cannot be set at insert time - the row they point to may not exist yet. The
// restore inserts these rows with the fields nulled, then patches them once
// every row exists.
// =============================================================================

export const SNAPSHOT_TABLES = [
  "roles",
  "permissions",
  "role_permissions",
  "designations",
  "holidays",
  "leave_types",
  "attendance_policies",
  "hikvision_devices",
  "email_templates",
  "qr_sessions",
  "verification_tokens",
  "departments", // defer: head_id, parent_id
  "employees", // defer: manager_id, dotted_manager_id
  "accounts",
  "sessions",
  "employee_roles",
  "audit_logs",
  "documents",
  "employee_documents",
  "notifications",
  "attendance_logs",
  "floating_holiday_selections",
  "wfh_requests",
  "leave_balances",
  "leave_requests",
  "salary_structures",
  "perf_kpis",
  "gps_check_ins",
  "password_resets",
  "job_postings",
  "projects",
  "payroll_records",
  "email_logs",
  "project_teams",
  "project_members",
  "project_tasks",
  "project_resources",
  "project_activities",
  "project_messages",
  "project_password_entries",
  "timesheets",
  "applicants",
  "project_team_members",
  "task_comments",
  "task_checklist_items",
  "interviews",
] as const

export type SnapshotTable = (typeof SNAPSHOT_TABLES)[number]

// Self-referential / circular foreign keys (snake_case) patched in a 2nd pass.
export const DEFERRED_FIELDS: Record<string, string[]> = {
  departments: ["head_id", "parent_id"],
  employees: ["manager_id", "dotted_manager_id"],
}
