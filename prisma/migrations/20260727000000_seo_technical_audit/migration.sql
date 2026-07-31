-- Phase 2 of the SEO plan (step 6): technical audit. One table recording each
-- crawl run for a site plus its findings. Additive - no changes to existing
-- tables.

CREATE TABLE IF NOT EXISTS "seo_technical_audits" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "pages_checked" INTEGER NOT NULL DEFAULT 0,
    "critical_count" INTEGER NOT NULL DEFAULT 0,
    "warning_count" INTEGER NOT NULL DEFAULT 0,
    "sitemap_ok" BOOLEAN NOT NULL DEFAULT false,
    "robots_ok" BOOLEAN NOT NULL DEFAULT false,
    "sitemap_urls" INTEGER NOT NULL DEFAULT 0,
    "pages" JSONB NOT NULL,
    "site_issues" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "seo_technical_audits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "seo_technical_audits_property_id_created_at_idx" ON "seo_technical_audits"("property_id", "created_at");

DO $$ BEGIN
    ALTER TABLE "seo_technical_audits" ADD CONSTRAINT "seo_technical_audits_property_id_fkey"
        FOREIGN KEY ("property_id") REFERENCES "seo_properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
