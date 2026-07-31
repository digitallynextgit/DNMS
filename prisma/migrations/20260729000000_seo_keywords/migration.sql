-- Phase 3 of the SEO plan (step 4): the prioritized keyword backlog. One table,
-- additive - no changes to existing tables.

CREATE TABLE IF NOT EXISTS "seo_keywords" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ctr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "intent" TEXT NOT NULL DEFAULT 'other',
    "winnable" BOOLEAN,
    "business_value" INTEGER NOT NULL DEFAULT 3,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'BACKLOG',
    "task_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "seo_keywords_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "seo_keywords_property_id_query_key" ON "seo_keywords"("property_id", "query");
CREATE INDEX IF NOT EXISTS "seo_keywords_property_id_score_idx" ON "seo_keywords"("property_id", "score");
CREATE INDEX IF NOT EXISTS "seo_keywords_property_id_status_idx" ON "seo_keywords"("property_id", "status");

DO $$ BEGIN
    ALTER TABLE "seo_keywords" ADD CONSTRAINT "seo_keywords_property_id_fkey"
        FOREIGN KEY ("property_id") REFERENCES "seo_properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
