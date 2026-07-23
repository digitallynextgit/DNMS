-- A client project can own MANY sites: KYG is one account with 13 subdomains
-- sharing a team, Drive folder and content calendar. So `project_id` stops being
-- unique, and each row gains a human label.
--
-- Safe on the shared DB: seo_properties was created empty in the previous
-- migration, so `label` can be added NOT NULL without a backfill. The DEFAULT is
-- kept afterwards only as a guard for any row inserted outside the app.

ALTER TABLE "seo_properties" ADD COLUMN IF NOT EXISTS "label" TEXT NOT NULL DEFAULT 'Main site';
ALTER TABLE "seo_properties" ADD COLUMN IF NOT EXISTS "is_primary" BOOLEAN NOT NULL DEFAULT false;

DROP INDEX IF EXISTS "seo_properties_project_id_key";

CREATE INDEX IF NOT EXISTS "seo_properties_project_id_idx" ON "seo_properties"("project_id");
CREATE UNIQUE INDEX IF NOT EXISTS "seo_properties_project_id_domain_key" ON "seo_properties"("project_id", "domain");
