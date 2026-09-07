-- Deliverables: what a person PRODUCED for a project - a video, a set of
-- product pages, a packaging design - dated, linked, with files.
--
-- Hand-written (migrate dev cannot create a shadow DB here - P3014), additive
-- only, and safe to apply while the previous build is serving: one new table,
-- one nullable column on project_resources.
--
-- Files are NOT a new store. An uploaded deliverable is a project_resources row
-- under the (already existing, previously empty) DELIVERABLES category, linked
-- back by deliverable_id - so it shows on the Files tab too, and deleting the
-- log entry leaves the file where it is (SET NULL): a wrong log line must not
-- destroy real work product.

CREATE TABLE "project_deliverables" (
    "tenant_id"      TEXT NOT NULL DEFAULT '0197d1ab-0000-7000-8000-000000000001',
    "id"             TEXT NOT NULL,
    "project_id"     TEXT NOT NULL,
    "team_id"        TEXT,
    "employee_id"    TEXT NOT NULL,
    "logged_by_id"   TEXT,
    "task_id"        TEXT,
    "type"           TEXT NOT NULL,
    "title"          TEXT NOT NULL,
    "quantity"       INTEGER NOT NULL DEFAULT 1,
    "started_on"     DATE,
    "completed_on"   DATE NOT NULL,
    "links"          TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "notes"          TEXT,
    "verified_by_id" TEXT,
    "verified_at"    TIMESTAMP(3),
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_deliverables_pkey" PRIMARY KEY ("id")
);

-- "What did the video team make in August" is a range on completed_on, per
-- project and per person, so both carry it.
CREATE INDEX "project_deliverables_project_id_completed_on_idx"  ON "project_deliverables"("project_id", "completed_on");
CREATE INDEX "project_deliverables_employee_id_completed_on_idx" ON "project_deliverables"("employee_id", "completed_on");
CREATE INDEX "project_deliverables_team_id_idx"                  ON "project_deliverables"("team_id");
CREATE INDEX "project_deliverables_task_id_idx"                  ON "project_deliverables"("task_id");
CREATE INDEX "project_deliverables_tenant_id_idx"                ON "project_deliverables"("tenant_id");

ALTER TABLE "project_deliverables"
    ADD CONSTRAINT "project_deliverables_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_deliverables"
    ADD CONSTRAINT "project_deliverables_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- The team may be dissolved later; the output still happened.
ALTER TABLE "project_deliverables"
    ADD CONSTRAINT "project_deliverables_team_id_fkey"
    FOREIGN KEY ("team_id") REFERENCES "project_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "project_deliverables"
    ADD CONSTRAINT "project_deliverables_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_deliverables"
    ADD CONSTRAINT "project_deliverables_logged_by_id_fkey"
    FOREIGN KEY ("logged_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "project_deliverables"
    ADD CONSTRAINT "project_deliverables_verified_by_id_fkey"
    FOREIGN KEY ("verified_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "project_deliverables"
    ADD CONSTRAINT "project_deliverables_task_id_fkey"
    FOREIGN KEY ("task_id") REFERENCES "project_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The file side of the link.
ALTER TABLE "project_resources"
    ADD COLUMN IF NOT EXISTS "deliverable_id" TEXT;
CREATE INDEX IF NOT EXISTS "project_resources_deliverable_id_idx"
    ON "project_resources"("deliverable_id");
ALTER TABLE "project_resources"
    ADD CONSTRAINT "project_resources_deliverable_id_fkey"
    FOREIGN KEY ("deliverable_id") REFERENCES "project_deliverables"("id") ON DELETE SET NULL ON UPDATE CASCADE;
