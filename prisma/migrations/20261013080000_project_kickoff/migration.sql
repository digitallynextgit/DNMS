-- Pre-campaign "must-haves" checklist per project, for the Account Manager. Additive, so the live
-- build keeps working before the new code is deployed. Hand-written; apply with
-- `npx prisma migrate deploy`.

CREATE TABLE IF NOT EXISTS "project_kickoff_items" (
    "tenant_id"     TEXT NOT NULL DEFAULT '0197d1ab-0000-7000-8000-000000000001',
    "id"            TEXT NOT NULL,
    "project_id"    TEXT NOT NULL,
    "key"           TEXT NOT NULL,
    "section"       TEXT NOT NULL,
    "text"          TEXT NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_done"       BOOLEAN NOT NULL DEFAULT false,
    "done_at"       TIMESTAMP(3),
    "done_by_id"    TEXT,
    "note"          TEXT,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_kickoff_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_kickoff_items_project_id_key_key"
    ON "project_kickoff_items"("project_id", "key");
CREATE INDEX IF NOT EXISTS "project_kickoff_items_tenant_id_idx" ON "project_kickoff_items"("tenant_id");

ALTER TABLE "project_kickoff_items"
    ADD CONSTRAINT "project_kickoff_items_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_kickoff_items"
    ADD CONSTRAINT "project_kickoff_items_done_by_id_fkey"
    FOREIGN KEY ("done_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
