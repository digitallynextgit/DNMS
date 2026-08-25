-- Performance indexes (audit 2026-08-24 §3.18).
-- Every hot query shape below previously had no supporting index.

-- ProjectTask: dueDate had NO index at all, yet every task list filters or
-- sorts on it ("my tasks due soon", the project board, progress buckets).
CREATE INDEX IF NOT EXISTS "project_tasks_assignee_id_due_date_idx" ON "project_tasks"("assignee_id", "due_date");
CREATE INDEX IF NOT EXISTS "project_tasks_project_id_due_date_idx"  ON "project_tasks"("project_id",  "due_date");
CREATE INDEX IF NOT EXISTS "project_tasks_project_id_status_idx"    ON "project_tasks"("project_id",  "status");

-- AuditLog: task/entity history filters (entity_type, entity_id) and was a full
-- table scan, fanned out up to 50-wide by the task timeline against a 10-conn pool.
CREATE INDEX IF NOT EXISTS "audit_logs_entity_type_entity_id_created_at_idx" ON "audit_logs"("entity_type", "entity_id", "created_at");

-- Leave/WFH lists sort by created_at with skip/take on every page.
CREATE INDEX IF NOT EXISTS "leave_requests_status_created_at_idx" ON "leave_requests"("status", "created_at");
CREATE INDEX IF NOT EXISTS "wfh_requests_status_created_at_idx"   ON "wfh_requests"("status",   "created_at");

-- ProjectActivity is queried as (project_id ORDER BY created_at DESC) but was
-- only indexed on each column separately.
CREATE INDEX IF NOT EXISTS "project_activities_project_id_created_at_idx" ON "project_activities"("project_id", "created_at");

-- Evaluation: the generator checks (employee_id, period_label) then inserts, so a
-- concurrent cron + manual run duplicates evaluations. Verified 0 existing dupes.
CREATE UNIQUE INDEX IF NOT EXISTS "evaluations_employee_id_period_label_key" ON "evaluations"("employee_id", "period_label");

-- WfhRequest: the duplicate guard is scoped to PENDING/APPROVED because
-- re-applying after a REJECTED/CANCELLED request is legitimate. A plain UNIQUE
-- would forbid that, so this is a PARTIAL unique index matching the guard
-- exactly. Prisma's schema DSL cannot express partial indexes, which is why this
-- lives only here (and why prisma/schema.prisma carries a note saying so).
CREATE UNIQUE INDEX IF NOT EXISTS "wfh_requests_employee_id_date_active_key"
  ON "wfh_requests"("employee_id", "date")
  WHERE "status" IN ('PENDING', 'APPROVED');
