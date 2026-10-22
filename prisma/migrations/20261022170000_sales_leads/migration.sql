-- Sales tab: leads per project and what happened with each. Additive; hand-written, apply with
-- `npx prisma migrate deploy`.

CREATE TABLE IF NOT EXISTS "sales_leads" (
    "tenant_id"             TEXT NOT NULL DEFAULT '0197d1ab-0000-7000-8000-000000000001',
    "id"                    TEXT NOT NULL,
    "project_id"            TEXT NOT NULL,
    "business"              TEXT NOT NULL,
    "contact_name"          TEXT,
    "phone"                 TEXT,
    "email"                 TEXT,
    "website"               TEXT,
    "category"              TEXT,
    "area"                  TEXT,
    "city"                  TEXT,
    "address"               TEXT,
    "maps_url"              TEXT,
    "rating"                DOUBLE PRECISION,
    "reviews_count"         INTEGER,
    "stage"                 TEXT NOT NULL DEFAULT 'NEW',
    "lost_reason"           TEXT,
    "value"                 DOUBLE PRECISION,
    "assignee_id"           TEXT,
    "next_follow_up"        DATE,
    "follow_up_reminded_on" DATE,
    "do_not_contact"        BOOLEAN NOT NULL DEFAULT false,
    "source"                TEXT,
    "notes"                 TEXT,
    "created_by_id"         TEXT,
    "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"            TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_leads_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sales_leads_stage_check"
        CHECK ("stage" IN ('NEW', 'CONTACTED', 'INTERESTED', 'VISIT', 'QUOTATION', 'WON', 'LOST'))
);

CREATE INDEX IF NOT EXISTS "sales_leads_project_id_stage_idx" ON "sales_leads"("project_id", "stage");
CREATE INDEX IF NOT EXISTS "sales_leads_assignee_id_idx" ON "sales_leads"("assignee_id");
CREATE INDEX IF NOT EXISTS "sales_leads_next_follow_up_idx" ON "sales_leads"("next_follow_up");
CREATE INDEX IF NOT EXISTS "sales_leads_tenant_id_idx" ON "sales_leads"("tenant_id");

ALTER TABLE "sales_leads"
    ADD CONSTRAINT "sales_leads_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_leads"
    ADD CONSTRAINT "sales_leads_assignee_id_fkey"
    FOREIGN KEY ("assignee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "sales_lead_activities" (
    "tenant_id"  TEXT NOT NULL DEFAULT '0197d1ab-0000-7000-8000-000000000001',
    "id"         TEXT NOT NULL,
    "lead_id"    TEXT NOT NULL,
    "actor_id"   TEXT,
    "kind"       TEXT NOT NULL,
    "note"       TEXT,
    "from_stage" TEXT,
    "to_stage"   TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_lead_activities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "sales_lead_activities_lead_id_created_at_idx" ON "sales_lead_activities"("lead_id", "created_at");
CREATE INDEX IF NOT EXISTS "sales_lead_activities_tenant_id_idx" ON "sales_lead_activities"("tenant_id");

ALTER TABLE "sales_lead_activities"
    ADD CONSTRAINT "sales_lead_activities_lead_id_fkey"
    FOREIGN KEY ("lead_id") REFERENCES "sales_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_lead_activities"
    ADD CONSTRAINT "sales_lead_activities_actor_id_fkey"
    FOREIGN KEY ("actor_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
