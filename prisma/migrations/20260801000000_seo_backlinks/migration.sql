-- Step 8 of the SEO plan: off-page / backlinks. One table storing each linking
-- page, diffed on every import so lost links are marked and net-new referring
-- domains can feed the scorecard. Additive - no changes to existing tables.

CREATE TABLE IF NOT EXISTS "seo_backlinks" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "source_domain" TEXT NOT NULL,
    "target_url" TEXT,
    "anchor" TEXT,
    "domain_rating" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "first_seen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "seo_backlinks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "seo_backlinks_property_id_source_url_key" ON "seo_backlinks"("property_id", "source_url");
CREATE INDEX IF NOT EXISTS "seo_backlinks_property_id_status_idx" ON "seo_backlinks"("property_id", "status");
CREATE INDEX IF NOT EXISTS "seo_backlinks_property_id_source_domain_idx" ON "seo_backlinks"("property_id", "source_domain");
CREATE INDEX IF NOT EXISTS "seo_backlinks_property_id_first_seen_idx" ON "seo_backlinks"("property_id", "first_seen");

DO $$ BEGIN
    ALTER TABLE "seo_backlinks" ADD CONSTRAINT "seo_backlinks_property_id_fkey"
        FOREIGN KEY ("property_id") REFERENCES "seo_properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
