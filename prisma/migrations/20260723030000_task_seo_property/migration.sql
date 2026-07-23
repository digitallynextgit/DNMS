-- Tasks can now be tagged to a specific tracked site, so an account like KYG
-- (13 subdomains under one project) can show what is being done per subdomain.
-- Additive: one nullable column. NULL means "the project as a whole", which is
-- exactly how every existing task behaves.

ALTER TABLE "project_tasks" ADD COLUMN IF NOT EXISTS "seo_property_id" TEXT;

CREATE INDEX IF NOT EXISTS "project_tasks_seo_property_id_idx" ON "project_tasks"("seo_property_id");

-- SET NULL: removing a tracked site must not delete the work history behind it.
DO $$ BEGIN
    ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_seo_property_id_fkey"
        FOREIGN KEY ("seo_property_id") REFERENCES "seo_properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
