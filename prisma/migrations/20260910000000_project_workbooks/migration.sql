-- Workbooks: a named set of tabs, which is what the Calendars UI calls a
-- "sheet". Each tab is an existing project_sheets row (its own grid); the
-- workbook holds only the name and the order.
--
-- Hand-written (migrate dev cannot create a shadow DB here - P3014). Additive
-- plus one back-fill: every existing sheet becomes a workbook of one tab,
-- keeping its name and position. The workbook reuses the sheet's id, so the
-- back-fill is a single UPDATE and nothing needs a generated uuid.

CREATE TABLE "project_workbooks" (
    "tenant_id"     TEXT NOT NULL DEFAULT '0197d1ab-0000-7000-8000-000000000001',
    "id"            TEXT NOT NULL,
    "project_id"    TEXT NOT NULL,
    "name"          TEXT NOT NULL,
    "position"      INTEGER NOT NULL DEFAULT 0,
    "created_by_id" TEXT,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_workbooks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_workbooks_project_id_name_key" ON "project_workbooks"("project_id", "name");
CREATE INDEX "project_workbooks_project_id_idx" ON "project_workbooks"("project_id");
CREATE INDEX "project_workbooks_tenant_id_idx" ON "project_workbooks"("tenant_id");

ALTER TABLE "project_workbooks"
    ADD CONSTRAINT "project_workbooks_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_workbooks"
    ADD CONSTRAINT "project_workbooks_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_workbooks"
    ADD CONSTRAINT "project_workbooks_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Back-fill: one workbook per existing sheet, same id.
INSERT INTO "project_workbooks"
    ("tenant_id", "id", "project_id", "name", "position", "created_by_id", "created_at", "updated_at")
SELECT "tenant_id", "id", "project_id", "name", "position", "created_by_id", "created_at", "updated_at"
FROM "project_sheets";

ALTER TABLE "project_sheets" ADD COLUMN "workbook_id" TEXT;
UPDATE "project_sheets" SET "workbook_id" = "id";
ALTER TABLE "project_sheets" ALTER COLUMN "workbook_id" SET NOT NULL;

-- Tab names are unique within their workbook now, not across the project.
DROP INDEX IF EXISTS "project_sheets_project_id_name_key";
CREATE UNIQUE INDEX "project_sheets_workbook_id_name_key" ON "project_sheets"("workbook_id", "name");
CREATE INDEX "project_sheets_workbook_id_idx" ON "project_sheets"("workbook_id");

ALTER TABLE "project_sheets"
    ADD CONSTRAINT "project_sheets_workbook_id_fkey"
    FOREIGN KEY ("workbook_id") REFERENCES "project_workbooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
