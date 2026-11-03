-- Web analytics setup checklist per project (Analytics > Web analytics checklist). Additive, so the
-- live build keeps working before the new code is deployed. Hand-written; apply with
-- `npx prisma migrate deploy`.

CREATE TABLE IF NOT EXISTS "project_web_checklist_items" (
    "tenant_id"    TEXT NOT NULL DEFAULT '0197d1ab-0000-7000-8000-000000000001',
    "id"           TEXT NOT NULL,
    "project_id"   TEXT NOT NULL,
    "key"          TEXT NOT NULL,
    "status"       TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "status_at"    TIMESTAMP(3),
    "status_by_id" TEXT,
    "note"         TEXT,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_web_checklist_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_web_checklist_items_project_id_key_key"
    ON "project_web_checklist_items"("project_id", "key");
CREATE INDEX IF NOT EXISTS "project_web_checklist_items_tenant_id_idx"
    ON "project_web_checklist_items"("tenant_id");

ALTER TABLE "project_web_checklist_items"
    ADD CONSTRAINT "project_web_checklist_items_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_web_checklist_items"
    ADD CONSTRAINT "project_web_checklist_items_status_by_id_fkey"
    FOREIGN KEY ("status_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
