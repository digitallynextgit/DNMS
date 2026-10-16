-- A per-tab API for calendar tabs (e.g. the H2S website form -> BD / Sales Calendar, "BD sales").
-- Additive, so the live build keeps working before the new code is deployed. Hand-written; apply
-- with `npx prisma migrate deploy`.

CREATE TABLE IF NOT EXISTS "project_sheet_intakes" (
    "tenant_id"     TEXT NOT NULL DEFAULT '0197d1ab-0000-7000-8000-000000000001',
    "id"            TEXT NOT NULL,
    "project_id"    TEXT NOT NULL,
    "workbook_name" TEXT NOT NULL,
    "tab_name"      TEXT NOT NULL,
    "secret_hash"   TEXT NOT NULL,
    "secret_enc"    TEXT NOT NULL,
    "created_by_id" TEXT,
    "rows_received" INTEGER NOT NULL DEFAULT 0,
    "last_used_at"  TIMESTAMP(3),
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_sheet_intakes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_sheet_intakes_project_id_workbook_name_tab_name_key"
    ON "project_sheet_intakes"("project_id", "workbook_name", "tab_name");
CREATE INDEX IF NOT EXISTS "project_sheet_intakes_tenant_id_idx"
    ON "project_sheet_intakes"("tenant_id");

ALTER TABLE "project_sheet_intakes"
    ADD CONSTRAINT "project_sheet_intakes_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_sheet_intakes"
    ADD CONSTRAINT "project_sheet_intakes_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "project_sheet_intake_submissions" (
    "tenant_id"   TEXT NOT NULL DEFAULT '0197d1ab-0000-7000-8000-000000000001',
    "id"          TEXT NOT NULL,
    "intake_id"   TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "sheet_id"    TEXT,
    "row_id"      TEXT,
    "month"       TEXT,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_sheet_intake_submissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_sheet_intake_submissions_intake_id_external_id_key"
    ON "project_sheet_intake_submissions"("intake_id", "external_id");
CREATE INDEX IF NOT EXISTS "project_sheet_intake_submissions_tenant_id_idx"
    ON "project_sheet_intake_submissions"("tenant_id");

ALTER TABLE "project_sheet_intake_submissions"
    ADD CONSTRAINT "project_sheet_intake_submissions_intake_id_fkey"
    FOREIGN KEY ("intake_id") REFERENCES "project_sheet_intakes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_sheet_intake_submissions"
    ADD CONSTRAINT "project_sheet_intake_submissions_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
