-- Phase 5 of the SEO plan (step 7): the content loop. One table tracking each
-- content piece from brief -> write -> QA -> publish -> 30-day check. Additive -
-- no changes to existing tables.

CREATE TABLE IF NOT EXISTS "seo_content_briefs" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "keyword_id" TEXT,
    "target_query" TEXT NOT NULL,
    "intent" TEXT NOT NULL DEFAULT 'other',
    "status" TEXT NOT NULL DEFAULT 'BRIEF',
    "outline" JSONB NOT NULL,
    "angle" TEXT,
    "notes" TEXT,
    "published_url" TEXT,
    "published_at" TIMESTAMP(3),
    "qa" JSONB,
    "baseline_position" DOUBLE PRECISION,
    "review_at" TIMESTAMP(3),
    "review_position" DOUBLE PRECISION,
    "review_outcome" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "seo_content_briefs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "seo_content_briefs_property_id_status_idx" ON "seo_content_briefs"("property_id", "status");
CREATE INDEX IF NOT EXISTS "seo_content_briefs_review_at_idx" ON "seo_content_briefs"("review_at");

DO $$ BEGIN
    ALTER TABLE "seo_content_briefs" ADD CONSTRAINT "seo_content_briefs_property_id_fkey"
        FOREIGN KEY ("property_id") REFERENCES "seo_properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
