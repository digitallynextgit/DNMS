-- A planned deliverable can be split into many tasks (project_tasks.deliverable_id), and a task
-- carries dated work logs whose quantity adds to that deliverable's made count. Additive, so the
-- live build keeps working before the new code is deployed. Hand-written; apply with
-- `npx prisma migrate deploy`.

ALTER TABLE "project_tasks" ADD COLUMN IF NOT EXISTS "deliverable_id" TEXT;

ALTER TABLE "project_tasks"
    ADD CONSTRAINT "project_tasks_deliverable_id_fkey"
    FOREIGN KEY ("deliverable_id") REFERENCES "project_deliverables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "project_tasks_deliverable_id_idx" ON "project_tasks"("deliverable_id");

-- Until now a deliverable pointed at the one task that started or logged it; that task is part of it.
UPDATE "project_tasks" t
SET "deliverable_id" = d."id"
FROM (
    SELECT DISTINCT ON ("task_id") "task_id", "id"
    FROM "project_deliverables"
    WHERE "task_id" IS NOT NULL
    ORDER BY "task_id", "created_at"
) d
WHERE d."task_id" = t."id" AND t."deliverable_id" IS NULL;

CREATE TABLE IF NOT EXISTS "task_work_logs" (
    "tenant_id"   TEXT NOT NULL DEFAULT '0197d1ab-0000-7000-8000-000000000001',
    "id"          TEXT NOT NULL,
    "task_id"     TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "worked_on"   DATE NOT NULL,
    "note"        TEXT NOT NULL,
    "quantity"    INTEGER,
    "links"       TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_work_logs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "task_work_logs_quantity_check" CHECK ("quantity" IS NULL OR "quantity" > 0)
);

CREATE INDEX IF NOT EXISTS "task_work_logs_task_id_worked_on_idx" ON "task_work_logs"("task_id", "worked_on");
CREATE INDEX IF NOT EXISTS "task_work_logs_employee_id_worked_on_idx" ON "task_work_logs"("employee_id", "worked_on");
CREATE INDEX IF NOT EXISTS "task_work_logs_tenant_id_idx" ON "task_work_logs"("tenant_id");

ALTER TABLE "task_work_logs"
    ADD CONSTRAINT "task_work_logs_task_id_fkey"
    FOREIGN KEY ("task_id") REFERENCES "project_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "task_work_logs"
    ADD CONSTRAINT "task_work_logs_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "task_work_logs"
    ADD CONSTRAINT "task_work_logs_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
