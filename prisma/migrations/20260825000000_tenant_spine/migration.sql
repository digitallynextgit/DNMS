-- ============================================================================
-- M1 - Tenant spine.
--
-- Adds the tenants table, registers Digitally Next as the founding tenant, and
-- attributes every existing row to it.
--
-- ZERO-DOWNTIME CONTRACT (the deployed build knows nothing about tenants):
--   tenant_id is NOT NULL but carries a DEFAULT of the founding tenant, so an
--   INSERT from the currently-deployed code - which does not send the column -
--   still succeeds and lands in the right tenant. New code sets it explicitly.
--   The DEFAULT is removed in a later milestone, once every write is scoped.
--
-- Every statement is guarded so a partial apply can be re-run safely.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "tenants" (
    "id"            TEXT NOT NULL,
    "slug"          TEXT NOT NULL,
    "name"          TEXT NOT NULL,
    "status"        TEXT NOT NULL DEFAULT 'ACTIVE',
    "plan"          TEXT NOT NULL DEFAULT 'ENTERPRISE',
    "trial_ends_at" TIMESTAMP(3),
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenants_slug_key" ON "tenants"("slug");

-- The founding tenant. Everything that exists today belongs to it.
INSERT INTO "tenants" ("id", "slug", "name", "status", "plan", "created_at", "updated_at")
VALUES ('0197d1ab-0000-7000-8000-000000000001', 'digitallynext', 'Digitally Next', 'ACTIVE', 'ENTERPRISE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- Role
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "roles" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "roles" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "roles" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "roles_tenant_id_idx" ON "roles"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "roles" ADD CONSTRAINT "roles_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- RolePermission
ALTER TABLE "role_permissions" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "role_permissions" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "role_permissions" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "role_permissions" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "role_permissions_tenant_id_idx" ON "role_permissions"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- EmployeeRole
ALTER TABLE "employee_roles" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "employee_roles" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "employee_roles" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "employee_roles" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "employee_roles_tenant_id_idx" ON "employee_roles"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "employee_roles" ADD CONSTRAINT "employee_roles_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AuditLog
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "audit_logs" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "audit_logs" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "audit_logs" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "audit_logs_tenant_id_idx" ON "audit_logs"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Department
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "departments" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "departments" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "departments" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "departments_tenant_id_idx" ON "departments"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "departments" ADD CONSTRAINT "departments_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Designation
ALTER TABLE "designations" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "designations" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "designations" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "designations" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "designations_tenant_id_idx" ON "designations"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "designations" ADD CONSTRAINT "designations_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- JobRole
ALTER TABLE "job_roles" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "job_roles" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "job_roles" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "job_roles" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "job_roles_tenant_id_idx" ON "job_roles"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "job_roles" ADD CONSTRAINT "job_roles_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Employee
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "employees" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "employees" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "employees" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "employees_tenant_id_idx" ON "employees"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "employees" ADD CONSTRAINT "employees_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Document
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "documents" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "documents" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "documents" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "documents_tenant_id_idx" ON "documents"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- EmployeeDocument
ALTER TABLE "employee_documents" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "employee_documents" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "employee_documents" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "employee_documents" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "employee_documents_tenant_id_idx" ON "employee_documents"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- DocumentRequest
ALTER TABLE "document_requests" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "document_requests" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "document_requests" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "document_requests" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "document_requests_tenant_id_idx" ON "document_requests"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- EmailTemplate
ALTER TABLE "email_templates" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "email_templates" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "email_templates" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "email_templates" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "email_templates_tenant_id_idx" ON "email_templates"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- EmailLog
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "email_logs" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "email_logs" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "email_logs" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "email_logs_tenant_id_idx" ON "email_logs"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Notification
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "notifications" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "notifications" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "notifications" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "notifications_tenant_id_idx" ON "notifications"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- PushSubscription
ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "push_subscriptions" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "push_subscriptions" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "push_subscriptions" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "push_subscriptions_tenant_id_idx" ON "push_subscriptions"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- TaskReminderPreference
ALTER TABLE "task_reminder_preferences" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "task_reminder_preferences" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "task_reminder_preferences" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "task_reminder_preferences" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "task_reminder_preferences_tenant_id_idx" ON "task_reminder_preferences"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "task_reminder_preferences" ADD CONSTRAINT "task_reminder_preferences_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- TaskReminderState
ALTER TABLE "task_reminder_states" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "task_reminder_states" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "task_reminder_states" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "task_reminder_states" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "task_reminder_states_tenant_id_idx" ON "task_reminder_states"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "task_reminder_states" ADD CONSTRAINT "task_reminder_states_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- HikvisionDevice
ALTER TABLE "hikvision_devices" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "hikvision_devices" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "hikvision_devices" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "hikvision_devices" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "hikvision_devices_tenant_id_idx" ON "hikvision_devices"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "hikvision_devices" ADD CONSTRAINT "hikvision_devices_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AttendanceLog
ALTER TABLE "attendance_logs" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "attendance_logs" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "attendance_logs" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "attendance_logs" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "attendance_logs_tenant_id_idx" ON "attendance_logs"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "attendance_logs" ADD CONSTRAINT "attendance_logs_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AttendanceRegularization
ALTER TABLE "attendance_regularizations" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "attendance_regularizations" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "attendance_regularizations" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "attendance_regularizations" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "attendance_regularizations_tenant_id_idx" ON "attendance_regularizations"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "attendance_regularizations" ADD CONSTRAINT "attendance_regularizations_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Holiday
ALTER TABLE "holidays" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "holidays" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "holidays" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "holidays" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "holidays_tenant_id_idx" ON "holidays"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "holidays" ADD CONSTRAINT "holidays_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- WfhRequest
ALTER TABLE "wfh_requests" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "wfh_requests" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "wfh_requests" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "wfh_requests" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "wfh_requests_tenant_id_idx" ON "wfh_requests"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "wfh_requests" ADD CONSTRAINT "wfh_requests_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Resignation
ALTER TABLE "resignations" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "resignations" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "resignations" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "resignations" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "resignations_tenant_id_idx" ON "resignations"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "resignations" ADD CONSTRAINT "resignations_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- FloatingHolidaySelection
ALTER TABLE "floating_holiday_selections" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "floating_holiday_selections" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "floating_holiday_selections" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "floating_holiday_selections" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "floating_holiday_selections_tenant_id_idx" ON "floating_holiday_selections"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "floating_holiday_selections" ADD CONSTRAINT "floating_holiday_selections_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AttendancePolicy
ALTER TABLE "attendance_policies" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "attendance_policies" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "attendance_policies" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "attendance_policies" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "attendance_policies_tenant_id_idx" ON "attendance_policies"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "attendance_policies" ADD CONSTRAINT "attendance_policies_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- LeaveType
ALTER TABLE "leave_types" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "leave_types" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "leave_types" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "leave_types" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "leave_types_tenant_id_idx" ON "leave_types"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "leave_types" ADD CONSTRAINT "leave_types_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- LeavePolicy
ALTER TABLE "leave_policies" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "leave_policies" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "leave_policies" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "leave_policies" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "leave_policies_tenant_id_idx" ON "leave_policies"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "leave_policies" ADD CONSTRAINT "leave_policies_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- LeaveBalance
ALTER TABLE "leave_balances" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "leave_balances" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "leave_balances" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "leave_balances" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "leave_balances_tenant_id_idx" ON "leave_balances"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- LeaveRequest
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "leave_requests" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "leave_requests" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "leave_requests" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "leave_requests_tenant_id_idx" ON "leave_requests"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- SalaryStructure
ALTER TABLE "salary_structures" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "salary_structures" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "salary_structures" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "salary_structures" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "salary_structures_tenant_id_idx" ON "salary_structures"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "salary_structures" ADD CONSTRAINT "salary_structures_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- PayrollRecord
ALTER TABLE "payroll_records" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "payroll_records" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "payroll_records" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "payroll_records" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "payroll_records_tenant_id_idx" ON "payroll_records"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Project
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "projects" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "projects" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "projects" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "projects_tenant_id_idx" ON "projects"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "projects" ADD CONSTRAINT "projects_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ProjectIntegration
ALTER TABLE "project_integrations" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "project_integrations" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "project_integrations" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "project_integrations" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "project_integrations_tenant_id_idx" ON "project_integrations"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "project_integrations" ADD CONSTRAINT "project_integrations_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- MetaCampaign
ALTER TABLE "meta_campaigns" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "meta_campaigns" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "meta_campaigns" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "meta_campaigns" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "meta_campaigns_tenant_id_idx" ON "meta_campaigns"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "meta_campaigns" ADD CONSTRAINT "meta_campaigns_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- MetaCampaignMetric
ALTER TABLE "meta_campaign_metrics" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "meta_campaign_metrics" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "meta_campaign_metrics" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "meta_campaign_metrics" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "meta_campaign_metrics_tenant_id_idx" ON "meta_campaign_metrics"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "meta_campaign_metrics" ADD CONSTRAINT "meta_campaign_metrics_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ProjectBrand
ALTER TABLE "project_brands" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "project_brands" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "project_brands" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "project_brands" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "project_brands_tenant_id_idx" ON "project_brands"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "project_brands" ADD CONSTRAINT "project_brands_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- BrandAsset
ALTER TABLE "brand_assets" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "brand_assets" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "brand_assets" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "brand_assets" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "brand_assets_tenant_id_idx" ON "brand_assets"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "brand_assets" ADD CONSTRAINT "brand_assets_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ContentCalendarEntry
ALTER TABLE "content_calendar_entries" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "content_calendar_entries" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "content_calendar_entries" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "content_calendar_entries" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "content_calendar_entries_tenant_id_idx" ON "content_calendar_entries"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "content_calendar_entries" ADD CONSTRAINT "content_calendar_entries_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ProjectTeam
ALTER TABLE "project_teams" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "project_teams" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "project_teams" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "project_teams" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "project_teams_tenant_id_idx" ON "project_teams"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "project_teams" ADD CONSTRAINT "project_teams_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ProjectTeamMember
ALTER TABLE "project_team_members" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "project_team_members" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "project_team_members" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "project_team_members" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "project_team_members_tenant_id_idx" ON "project_team_members"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "project_team_members" ADD CONSTRAINT "project_team_members_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ProjectResource
ALTER TABLE "project_resources" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "project_resources" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "project_resources" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "project_resources" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "project_resources_tenant_id_idx" ON "project_resources"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "project_resources" ADD CONSTRAINT "project_resources_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ProjectMember
ALTER TABLE "project_members" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "project_members" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "project_members" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "project_members" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "project_members_tenant_id_idx" ON "project_members"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "project_members" ADD CONSTRAINT "project_members_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ProjectTask
ALTER TABLE "project_tasks" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "project_tasks" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "project_tasks" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "project_tasks" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "project_tasks_tenant_id_idx" ON "project_tasks"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- TaskComment
ALTER TABLE "task_comments" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "task_comments" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "task_comments" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "task_comments" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "task_comments_tenant_id_idx" ON "task_comments"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- TaskChecklistItem
ALTER TABLE "task_checklist_items" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "task_checklist_items" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "task_checklist_items" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "task_checklist_items" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "task_checklist_items_tenant_id_idx" ON "task_checklist_items"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "task_checklist_items" ADD CONSTRAINT "task_checklist_items_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- TaskStatusPeriod
ALTER TABLE "task_status_periods" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "task_status_periods" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "task_status_periods" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "task_status_periods" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "task_status_periods_tenant_id_idx" ON "task_status_periods"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "task_status_periods" ADD CONSTRAINT "task_status_periods_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ProjectRequirement
ALTER TABLE "project_requirements" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "project_requirements" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "project_requirements" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "project_requirements" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "project_requirements_tenant_id_idx" ON "project_requirements"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "project_requirements" ADD CONSTRAINT "project_requirements_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ProjectActivity
ALTER TABLE "project_activities" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "project_activities" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "project_activities" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "project_activities" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "project_activities_tenant_id_idx" ON "project_activities"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "project_activities" ADD CONSTRAINT "project_activities_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ProjectMessage
ALTER TABLE "project_messages" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "project_messages" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "project_messages" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "project_messages" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "project_messages_tenant_id_idx" ON "project_messages"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "project_messages" ADD CONSTRAINT "project_messages_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ProjectMessageReply
ALTER TABLE "project_message_replies" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "project_message_replies" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "project_message_replies" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "project_message_replies" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "project_message_replies_tenant_id_idx" ON "project_message_replies"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "project_message_replies" ADD CONSTRAINT "project_message_replies_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ProjectMessageAttachment
ALTER TABLE "project_message_attachments" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "project_message_attachments" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "project_message_attachments" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "project_message_attachments" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "project_message_attachments_tenant_id_idx" ON "project_message_attachments"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "project_message_attachments" ADD CONSTRAINT "project_message_attachments_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ProjectMessageReaction
ALTER TABLE "project_message_reactions" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "project_message_reactions" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "project_message_reactions" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "project_message_reactions" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "project_message_reactions_tenant_id_idx" ON "project_message_reactions"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "project_message_reactions" ADD CONSTRAINT "project_message_reactions_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ProjectMessageRead
ALTER TABLE "project_message_reads" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "project_message_reads" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "project_message_reads" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "project_message_reads" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "project_message_reads_tenant_id_idx" ON "project_message_reads"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "project_message_reads" ADD CONSTRAINT "project_message_reads_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ProjectPasswordEntry
ALTER TABLE "project_password_entries" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "project_password_entries" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "project_password_entries" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "project_password_entries" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "project_password_entries_tenant_id_idx" ON "project_password_entries"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "project_password_entries" ADD CONSTRAINT "project_password_entries_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Timesheet
ALTER TABLE "timesheets" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "timesheets" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "timesheets" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "timesheets" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "timesheets_tenant_id_idx" ON "timesheets"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- PerfKpi
ALTER TABLE "perf_kpis" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "perf_kpis" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "perf_kpis" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "perf_kpis" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "perf_kpis_tenant_id_idx" ON "perf_kpis"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "perf_kpis" ADD CONSTRAINT "perf_kpis_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Evaluation
ALTER TABLE "evaluations" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "evaluations" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "evaluations" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "evaluations" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "evaluations_tenant_id_idx" ON "evaluations"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- JobPosting
ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "job_postings" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "job_postings" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "job_postings" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "job_postings_tenant_id_idx" ON "job_postings"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Applicant
ALTER TABLE "applicants" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "applicants" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "applicants" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "applicants" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "applicants_tenant_id_idx" ON "applicants"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "applicants" ADD CONSTRAINT "applicants_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Interview
ALTER TABLE "interviews" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "interviews" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "interviews" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "interviews" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "interviews_tenant_id_idx" ON "interviews"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "interviews" ADD CONSTRAINT "interviews_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CareerGroup
ALTER TABLE "career_groups" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "career_groups" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "career_groups" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "career_groups" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "career_groups_tenant_id_idx" ON "career_groups"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "career_groups" ADD CONSTRAINT "career_groups_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CareerSubDepartment
ALTER TABLE "career_sub_departments" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "career_sub_departments" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "career_sub_departments" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "career_sub_departments" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "career_sub_departments_tenant_id_idx" ON "career_sub_departments"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "career_sub_departments" ADD CONSTRAINT "career_sub_departments_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CareerRole
ALTER TABLE "career_roles" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "career_roles" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "career_roles" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "career_roles" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "career_roles_tenant_id_idx" ON "career_roles"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "career_roles" ADD CONSTRAINT "career_roles_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CareerApplication
ALTER TABLE "career_applications" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "career_applications" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "career_applications" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "career_applications" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "career_applications_tenant_id_idx" ON "career_applications"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "career_applications" ADD CONSTRAINT "career_applications_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CareerOpening
ALTER TABLE "career_openings" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "career_openings" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "career_openings" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "career_openings" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "career_openings_tenant_id_idx" ON "career_openings"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "career_openings" ADD CONSTRAINT "career_openings_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- SeoProperty
ALTER TABLE "seo_properties" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "seo_properties" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "seo_properties" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "seo_properties" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "seo_properties_tenant_id_idx" ON "seo_properties"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "seo_properties" ADD CONSTRAINT "seo_properties_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- SeoSnapshot
ALTER TABLE "seo_snapshots" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "seo_snapshots" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "seo_snapshots" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "seo_snapshots" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "seo_snapshots_tenant_id_idx" ON "seo_snapshots"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "seo_snapshots" ADD CONSTRAINT "seo_snapshots_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- SeoQueryStat
ALTER TABLE "seo_query_stats" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "seo_query_stats" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "seo_query_stats" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "seo_query_stats" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "seo_query_stats_tenant_id_idx" ON "seo_query_stats"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "seo_query_stats" ADD CONSTRAINT "seo_query_stats_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- SeoPageStat
ALTER TABLE "seo_page_stats" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "seo_page_stats" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "seo_page_stats" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "seo_page_stats" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "seo_page_stats_tenant_id_idx" ON "seo_page_stats"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "seo_page_stats" ADD CONSTRAINT "seo_page_stats_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- SeoVitals
ALTER TABLE "seo_vitals" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "seo_vitals" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "seo_vitals" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "seo_vitals" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "seo_vitals_tenant_id_idx" ON "seo_vitals"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "seo_vitals" ADD CONSTRAINT "seo_vitals_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- SeoTraffic
ALTER TABLE "seo_traffic" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "seo_traffic" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "seo_traffic" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "seo_traffic" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "seo_traffic_tenant_id_idx" ON "seo_traffic"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "seo_traffic" ADD CONSTRAINT "seo_traffic_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- SeoScorecard
ALTER TABLE "seo_scorecards" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "seo_scorecards" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "seo_scorecards" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "seo_scorecards" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "seo_scorecards_tenant_id_idx" ON "seo_scorecards"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "seo_scorecards" ADD CONSTRAINT "seo_scorecards_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- SeoTechnicalAudit
ALTER TABLE "seo_technical_audits" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "seo_technical_audits" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "seo_technical_audits" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "seo_technical_audits" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "seo_technical_audits_tenant_id_idx" ON "seo_technical_audits"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "seo_technical_audits" ADD CONSTRAINT "seo_technical_audits_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- SeoKeyword
ALTER TABLE "seo_keywords" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "seo_keywords" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "seo_keywords" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "seo_keywords" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "seo_keywords_tenant_id_idx" ON "seo_keywords"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "seo_keywords" ADD CONSTRAINT "seo_keywords_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- SeoCompetitorAudit
ALTER TABLE "seo_competitor_audits" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "seo_competitor_audits" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "seo_competitor_audits" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "seo_competitor_audits" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "seo_competitor_audits_tenant_id_idx" ON "seo_competitor_audits"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "seo_competitor_audits" ADD CONSTRAINT "seo_competitor_audits_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- SeoContentBrief
ALTER TABLE "seo_content_briefs" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "seo_content_briefs" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "seo_content_briefs" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "seo_content_briefs" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "seo_content_briefs_tenant_id_idx" ON "seo_content_briefs"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "seo_content_briefs" ADD CONSTRAINT "seo_content_briefs_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- SeoBacklink
ALTER TABLE "seo_backlinks" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "seo_backlinks" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "seo_backlinks" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "seo_backlinks" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "seo_backlinks_tenant_id_idx" ON "seo_backlinks"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "seo_backlinks" ADD CONSTRAINT "seo_backlinks_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- SeoMonitorRun
ALTER TABLE "seo_monitor_runs" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "seo_monitor_runs" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "seo_monitor_runs" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "seo_monitor_runs" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "seo_monitor_runs_tenant_id_idx" ON "seo_monitor_runs"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "seo_monitor_runs" ADD CONSTRAINT "seo_monitor_runs_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ClientUser
ALTER TABLE "client_users" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "client_users" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "client_users" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "client_users" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "client_users_tenant_id_idx" ON "client_users"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "client_users" ADD CONSTRAINT "client_users_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ClientActivityLog
ALTER TABLE "client_activity_logs" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "client_activity_logs" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "client_activity_logs" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "client_activity_logs" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "client_activity_logs_tenant_id_idx" ON "client_activity_logs"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "client_activity_logs" ADD CONSTRAINT "client_activity_logs_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ClientProjectAccess
ALTER TABLE "client_project_access" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "client_project_access" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "client_project_access" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "client_project_access" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "client_project_access_tenant_id_idx" ON "client_project_access"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "client_project_access" ADD CONSTRAINT "client_project_access_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- MarketplaceChannel
ALTER TABLE "marketplace_channels" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "marketplace_channels" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "marketplace_channels" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "marketplace_channels" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "marketplace_channels_tenant_id_idx" ON "marketplace_channels"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "marketplace_channels" ADD CONSTRAINT "marketplace_channels_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Product
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "products" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "products" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "products" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "products_tenant_id_idx" ON "products"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "products" ADD CONSTRAINT "products_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ProjectAsset
ALTER TABLE "project_assets" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "project_assets" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "project_assets" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "project_assets" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "project_assets_tenant_id_idx" ON "project_assets"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "project_assets" ADD CONSTRAINT "project_assets_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- UptimeMonitor
ALTER TABLE "uptime_monitors" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "uptime_monitors" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "uptime_monitors" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "uptime_monitors" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "uptime_monitors_tenant_id_idx" ON "uptime_monitors"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "uptime_monitors" ADD CONSTRAINT "uptime_monitors_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- UptimeIncident
ALTER TABLE "uptime_incidents" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "uptime_incidents" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "uptime_incidents" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "uptime_incidents" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "uptime_incidents_tenant_id_idx" ON "uptime_incidents"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "uptime_incidents" ADD CONSTRAINT "uptime_incidents_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ProjectMailer
ALTER TABLE "project_mailers" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "project_mailers" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "project_mailers" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "project_mailers" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "project_mailers_tenant_id_idx" ON "project_mailers"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "project_mailers" ADD CONSTRAINT "project_mailers_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ProjectMailerAsset
ALTER TABLE "project_mailer_assets" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "project_mailer_assets" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "project_mailer_assets" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "project_mailer_assets" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "project_mailer_assets_tenant_id_idx" ON "project_mailer_assets"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "project_mailer_assets" ADD CONSTRAINT "project_mailer_assets_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ProjectEmailTemplate
ALTER TABLE "project_email_templates" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "project_email_templates" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "project_email_templates" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "project_email_templates" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "project_email_templates_tenant_id_idx" ON "project_email_templates"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "project_email_templates" ADD CONSTRAINT "project_email_templates_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ProjectRecipient
ALTER TABLE "project_recipients" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "project_recipients" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "project_recipients" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "project_recipients" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "project_recipients_tenant_id_idx" ON "project_recipients"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "project_recipients" ADD CONSTRAINT "project_recipients_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ProjectCampaign
ALTER TABLE "project_campaigns" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "project_campaigns" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "project_campaigns" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "project_campaigns" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "project_campaigns_tenant_id_idx" ON "project_campaigns"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "project_campaigns" ADD CONSTRAINT "project_campaigns_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ProjectCampaignSend
ALTER TABLE "project_campaign_sends" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "project_campaign_sends" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "project_campaign_sends" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "project_campaign_sends" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "project_campaign_sends_tenant_id_idx" ON "project_campaign_sends"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "project_campaign_sends" ADD CONSTRAINT "project_campaign_sends_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Announcement
ALTER TABLE "announcements" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "announcements" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "announcements" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "announcements" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "announcements_tenant_id_idx" ON "announcements"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "announcements" ADD CONSTRAINT "announcements_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- PhotoAlbum
ALTER TABLE "photo_albums" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "photo_albums" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "photo_albums" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "photo_albums" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "photo_albums_tenant_id_idx" ON "photo_albums"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "photo_albums" ADD CONSTRAINT "photo_albums_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Photo
ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "photos" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "photos" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "photos" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "photos_tenant_id_idx" ON "photos"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "photos" ADD CONSTRAINT "photos_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Conversation
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "conversations" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "conversations" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "conversations" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "conversations_tenant_id_idx" ON "conversations"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "conversations" ADD CONSTRAINT "conversations_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ConversationParticipant
ALTER TABLE "conversation_participants" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "conversation_participants" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "conversation_participants" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "conversation_participants" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "conversation_participants_tenant_id_idx" ON "conversation_participants"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ChatMessage
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "chat_messages" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "chat_messages" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "chat_messages" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "chat_messages_tenant_id_idx" ON "chat_messages"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ChatMessageReaction
ALTER TABLE "chat_message_reactions" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "chat_message_reactions" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "chat_message_reactions" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "chat_message_reactions" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "chat_message_reactions_tenant_id_idx" ON "chat_message_reactions"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "chat_message_reactions" ADD CONSTRAINT "chat_message_reactions_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ChatAttachment
ALTER TABLE "chat_attachments" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "chat_attachments" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "chat_attachments" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "chat_attachments" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "chat_attachments_tenant_id_idx" ON "chat_attachments"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "chat_attachments" ADD CONSTRAINT "chat_attachments_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- MessagePoll
ALTER TABLE "message_polls" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "message_polls" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "message_polls" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "message_polls" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "message_polls_tenant_id_idx" ON "message_polls"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "message_polls" ADD CONSTRAINT "message_polls_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- MessagePollOption
ALTER TABLE "message_poll_options" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "message_poll_options" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "message_poll_options" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "message_poll_options" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "message_poll_options_tenant_id_idx" ON "message_poll_options"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "message_poll_options" ADD CONSTRAINT "message_poll_options_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- MessagePollVote
ALTER TABLE "message_poll_votes" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "message_poll_votes" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "message_poll_votes" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "message_poll_votes" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "message_poll_votes_tenant_id_idx" ON "message_poll_votes"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "message_poll_votes" ADD CONSTRAINT "message_poll_votes_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- MessageEvent
ALTER TABLE "message_events" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "message_events" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "message_events" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "message_events" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "message_events_tenant_id_idx" ON "message_events"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "message_events" ADD CONSTRAINT "message_events_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- MessageContact
ALTER TABLE "message_contacts" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "message_contacts" SET "tenant_id" = '0197d1ab-0000-7000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "message_contacts" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "message_contacts" ALTER COLUMN "tenant_id" SET DEFAULT '0197d1ab-0000-7000-8000-000000000001';
CREATE INDEX IF NOT EXISTS "message_contacts_tenant_id_idx" ON "message_contacts"("tenant_id");
DO $$ BEGIN
  ALTER TABLE "message_contacts" ADD CONSTRAINT "message_contacts_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
