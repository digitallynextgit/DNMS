-- AI planning: every suggestion made while planning (and whether a person used it), and a cached
-- AI summary per calendar, kept until the calendar's content changes. Additive. Hand-written;
-- apply with `npx prisma migrate deploy`.

CREATE TABLE IF NOT EXISTS "project_ai_suggestions" (
    "tenant_id"       TEXT NOT NULL DEFAULT '0197d1ab-0000-7000-8000-000000000001',
    "id"              TEXT NOT NULL,
    "project_id"      TEXT NOT NULL,
    "kind"            TEXT NOT NULL,
    "input"           JSONB NOT NULL,
    "output"          JSONB NOT NULL,
    "requested_by_id" TEXT,
    "accepted_by_id"  TEXT,
    "accepted_at"     TIMESTAMP(3),
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_ai_suggestions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "project_ai_suggestions_project_id_kind_created_at_idx"
    ON "project_ai_suggestions"("project_id", "kind", "created_at");
CREATE INDEX IF NOT EXISTS "project_ai_suggestions_tenant_id_idx" ON "project_ai_suggestions"("tenant_id");

ALTER TABLE "project_ai_suggestions"
    ADD CONSTRAINT "project_ai_suggestions_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_ai_suggestions"
    ADD CONSTRAINT "project_ai_suggestions_requested_by_id_fkey"
    FOREIGN KEY ("requested_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "project_ai_suggestions"
    ADD CONSTRAINT "project_ai_suggestions_accepted_by_id_fkey"
    FOREIGN KEY ("accepted_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "project_ai_suggestions"
    ADD CONSTRAINT "project_ai_suggestions_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "project_workbook_summaries" (
    "tenant_id"    TEXT NOT NULL DEFAULT '0197d1ab-0000-7000-8000-000000000001',
    "id"           TEXT NOT NULL,
    "workbook_id"  TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "summary"      JSONB NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_workbook_summaries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_workbook_summaries_workbook_id_key"
    ON "project_workbook_summaries"("workbook_id");
CREATE INDEX IF NOT EXISTS "project_workbook_summaries_tenant_id_idx" ON "project_workbook_summaries"("tenant_id");

ALTER TABLE "project_workbook_summaries"
    ADD CONSTRAINT "project_workbook_summaries_workbook_id_fkey"
    FOREIGN KEY ("workbook_id") REFERENCES "project_workbooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_workbook_summaries"
    ADD CONSTRAINT "project_workbook_summaries_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
