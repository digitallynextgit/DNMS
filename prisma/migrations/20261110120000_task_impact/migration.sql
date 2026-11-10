-- Work sheet Impact: a per-task outcome note, and a weekly note per person per client row.
-- Additive, so the live build keeps working before the new code is deployed.
-- Hand-written; apply with `npx prisma migrate deploy`.

ALTER TABLE "project_tasks" ADD COLUMN IF NOT EXISTS "impact" TEXT;

CREATE TABLE IF NOT EXISTS "task_weekly_impacts" (
    "tenant_id"     TEXT NOT NULL DEFAULT '0197d1ab-0000-7000-8000-000000000001',
    "id"            TEXT NOT NULL,
    "employee_id"   TEXT NOT NULL,
    "project_id"    TEXT,
    "row_key"       TEXT NOT NULL,
    "week_start"    DATE NOT NULL,
    "note"          TEXT NOT NULL,
    "updated_by_id" TEXT,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_weekly_impacts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "task_weekly_impacts_employee_id_row_key_week_start_key"
    ON "task_weekly_impacts"("employee_id", "row_key", "week_start");
CREATE INDEX IF NOT EXISTS "task_weekly_impacts_project_id_week_start_idx"
    ON "task_weekly_impacts"("project_id", "week_start");
CREATE INDEX IF NOT EXISTS "task_weekly_impacts_tenant_id_idx" ON "task_weekly_impacts"("tenant_id");

ALTER TABLE "task_weekly_impacts"
    ADD CONSTRAINT "task_weekly_impacts_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_weekly_impacts"
    ADD CONSTRAINT "task_weekly_impacts_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_weekly_impacts"
    ADD CONSTRAINT "task_weekly_impacts_updated_by_id_fkey"
    FOREIGN KEY ("updated_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
