-- Phase 1 of the SEO plan: Core Web Vitals (step 6/9), GA4 organic traffic
-- (step 10) and the monthly weighted scorecard (step 10).
-- Additive: one array column on seo_properties plus three new tables.

ALTER TABLE "seo_properties" ADD COLUMN IF NOT EXISTS "money_pages" TEXT[] DEFAULT ARRAY[]::TEXT[];

CREATE TABLE IF NOT EXISTS "seo_vitals" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "form_factor" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "lcp_ms" INTEGER,
    "inp_ms" INTEGER,
    "cls" DOUBLE PRECISION,
    "fcp_ms" INTEGER,
    "ttfb_ms" INTEGER,
    "performance_score" INTEGER,
    "verdict" TEXT,
    "checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "seo_vitals_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "seo_vitals_property_id_checked_at_idx" ON "seo_vitals"("property_id", "checked_at");

CREATE TABLE IF NOT EXISTS "seo_traffic" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "sessions" INTEGER NOT NULL DEFAULT 0,
    "engaged_sessions" INTEGER NOT NULL DEFAULT 0,
    "conversions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ai_referrals" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'GA4',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "seo_traffic_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "seo_traffic_property_id_period_start_period_end_key" ON "seo_traffic"("property_id", "period_start", "period_end");
CREATE INDEX IF NOT EXISTS "seo_traffic_property_id_period_end_idx" ON "seo_traffic"("property_id", "period_end");

CREATE TABLE IF NOT EXISTS "seo_scorecards" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "coverage" DOUBLE PRECISION NOT NULL,
    "band" TEXT NOT NULL,
    "metrics" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "seo_scorecards_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "seo_scorecards_property_id_period_start_period_end_key" ON "seo_scorecards"("property_id", "period_start", "period_end");
CREATE INDEX IF NOT EXISTS "seo_scorecards_property_id_period_end_idx" ON "seo_scorecards"("property_id", "period_end");

DO $$ BEGIN
    ALTER TABLE "seo_vitals" ADD CONSTRAINT "seo_vitals_property_id_fkey"
        FOREIGN KEY ("property_id") REFERENCES "seo_properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "seo_traffic" ADD CONSTRAINT "seo_traffic_property_id_fkey"
        FOREIGN KEY ("property_id") REFERENCES "seo_properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "seo_scorecards" ADD CONSTRAINT "seo_scorecards_property_id_fkey"
        FOREIGN KEY ("property_id") REFERENCES "seo_properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
