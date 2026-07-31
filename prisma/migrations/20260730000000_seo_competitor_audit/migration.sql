-- Phase 4 of the SEO plan (step 5): competitor gap analysis. One table recording
-- each competitor-crawl run for a site plus the topic gaps it found. Additive -
-- no changes to existing tables.

CREATE TABLE IF NOT EXISTS "seo_competitor_audits" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "competitors_checked" INTEGER NOT NULL DEFAULT 0,
    "our_pages_checked" INTEGER NOT NULL DEFAULT 0,
    "gap_count" INTEGER NOT NULL DEFAULT 0,
    "competitors" JSONB NOT NULL,
    "gaps" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "seo_competitor_audits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "seo_competitor_audits_property_id_created_at_idx" ON "seo_competitor_audits"("property_id", "created_at");

DO $$ BEGIN
    ALTER TABLE "seo_competitor_audits" ADD CONSTRAINT "seo_competitor_audits_property_id_fkey"
        FOREIGN KEY ("property_id") REFERENCES "seo_properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
