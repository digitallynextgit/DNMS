-- Planner campaigns (one calendar per campaign, across services) and due-date reminder stamps on
-- calendar team plans. Additive; hand-written, apply with `npx prisma migrate deploy`.

CREATE TABLE IF NOT EXISTS "planner_campaigns" (
    "tenant_id"         TEXT NOT NULL DEFAULT '0197d1ab-0000-7000-8000-000000000001',
    "id"                TEXT NOT NULL,
    "project_id"        TEXT NOT NULL,
    "name"              TEXT NOT NULL,
    "brief"             TEXT,
    "start_date"        DATE NOT NULL,
    "deadline"          DATE NOT NULL,
    "owner_id"          TEXT,
    "services"          TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_by_id"     TEXT,
    "start_notified_at" TIMESTAMP(3),
    "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planner_campaigns_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "planner_campaigns_dates_check" CHECK ("deadline" >= "start_date")
);

CREATE UNIQUE INDEX IF NOT EXISTS "planner_campaigns_project_id_name_key" ON "planner_campaigns"("project_id", "name");
CREATE INDEX IF NOT EXISTS "planner_campaigns_project_id_start_date_idx" ON "planner_campaigns"("project_id", "start_date");
CREATE INDEX IF NOT EXISTS "planner_campaigns_tenant_id_idx" ON "planner_campaigns"("tenant_id");

ALTER TABLE "planner_campaigns"
    ADD CONSTRAINT "planner_campaigns_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "planner_campaigns"
    ADD CONSTRAINT "planner_campaigns_owner_id_fkey"
    FOREIGN KEY ("owner_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "project_workbooks" ADD COLUMN IF NOT EXISTS "campaign_id" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "project_workbooks_campaign_id_key" ON "project_workbooks"("campaign_id");
ALTER TABLE "project_workbooks"
    ADD CONSTRAINT "project_workbooks_campaign_id_fkey"
    FOREIGN KEY ("campaign_id") REFERENCES "planner_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_workbook_teams" ADD COLUMN IF NOT EXISTS "soon_reminded_at" TIMESTAMP(3);
ALTER TABLE "project_workbook_teams" ADD COLUMN IF NOT EXISTS "due_reminded_at" TIMESTAMP(3);
ALTER TABLE "project_workbook_teams" ADD COLUMN IF NOT EXISTS "overdue_reminded_at" TIMESTAMP(3);
