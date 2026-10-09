-- Ties a calendar series to the project service it is for (a PROJECT_SERVICES code). Additive, so
-- the live build keeps working before the new code is deployed. Hand-written; apply with
-- `npx prisma migrate deploy`.
ALTER TABLE "project_workbooks" ADD COLUMN IF NOT EXISTS "service" TEXT;

CREATE INDEX IF NOT EXISTS "project_workbooks_project_id_service_idx"
    ON "project_workbooks" ("project_id", "service");
