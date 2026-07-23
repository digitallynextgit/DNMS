-- SEO module. Purely additive: four new tables, no changes to existing ones.
-- `seo_properties` is the per-project config the automation reads (domain,
-- money keywords, competitors, targets, Google property ids). The weekly cron
-- writes immutable `seo_snapshots` rows from Search Console with their
-- per-query / per-page breakdown, so growth is a diff between snapshots.

CREATE TABLE IF NOT EXISTS "seo_properties" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "site_url" TEXT,
    "ga_property_id" TEXT,
    "money_keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "competitors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "target_clicks" INTEGER,
    "target_position" DOUBLE PRECISION,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_synced_at" TIMESTAMP(3),
    "last_sync_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "seo_properties_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "seo_properties_project_id_key" ON "seo_properties"("project_id");
CREATE INDEX IF NOT EXISTS "seo_properties_is_active_idx" ON "seo_properties"("is_active");

CREATE TABLE IF NOT EXISTS "seo_snapshots" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "ctr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'GSC',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "seo_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "seo_snapshots_property_id_period_start_period_end_key" ON "seo_snapshots"("property_id", "period_start", "period_end");
CREATE INDEX IF NOT EXISTS "seo_snapshots_property_id_period_end_idx" ON "seo_snapshots"("property_id", "period_end");

CREATE TABLE IF NOT EXISTS "seo_query_stats" (
    "id" TEXT NOT NULL,
    "snapshot_id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "ctr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
    CONSTRAINT "seo_query_stats_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "seo_query_stats_snapshot_id_idx" ON "seo_query_stats"("snapshot_id");
CREATE INDEX IF NOT EXISTS "seo_query_stats_snapshot_id_clicks_idx" ON "seo_query_stats"("snapshot_id", "clicks");

CREATE TABLE IF NOT EXISTS "seo_page_stats" (
    "id" TEXT NOT NULL,
    "snapshot_id" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "ctr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
    CONSTRAINT "seo_page_stats_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "seo_page_stats_snapshot_id_idx" ON "seo_page_stats"("snapshot_id");
CREATE INDEX IF NOT EXISTS "seo_page_stats_snapshot_id_clicks_idx" ON "seo_page_stats"("snapshot_id", "clicks");

DO $$ BEGIN
    ALTER TABLE "seo_properties" ADD CONSTRAINT "seo_properties_project_id_fkey"
        FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "seo_snapshots" ADD CONSTRAINT "seo_snapshots_property_id_fkey"
        FOREIGN KEY ("property_id") REFERENCES "seo_properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "seo_query_stats" ADD CONSTRAINT "seo_query_stats_snapshot_id_fkey"
        FOREIGN KEY ("snapshot_id") REFERENCES "seo_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "seo_page_stats" ADD CONSTRAINT "seo_page_stats_snapshot_id_fkey"
        FOREIGN KEY ("snapshot_id") REFERENCES "seo_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
