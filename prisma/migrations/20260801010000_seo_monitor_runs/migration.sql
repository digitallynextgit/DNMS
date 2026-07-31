-- Step 9 of the SEO plan: the daily accident monitor. One row per property per
-- run (money-page uptime + noindex + robots check), kept as history so alerts
-- fire only on a change of state. Additive - no changes to existing tables.

CREATE TABLE IF NOT EXISTS "seo_monitor_runs" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "pages_ok" INTEGER NOT NULL DEFAULT 0,
    "pages_total" INTEGER NOT NULL DEFAULT 0,
    "issues" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "seo_monitor_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "seo_monitor_runs_property_id_created_at_idx" ON "seo_monitor_runs"("property_id", "created_at");

DO $$ BEGIN
    ALTER TABLE "seo_monitor_runs" ADD CONSTRAINT "seo_monitor_runs_property_id_fkey"
        FOREIGN KEY ("property_id") REFERENCES "seo_properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
