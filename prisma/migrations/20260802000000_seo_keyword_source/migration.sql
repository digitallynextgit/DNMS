-- Keyword provenance: rows can now be mined from a competitor's page titles and
-- headings, not just pulled from our own Search Console queries. Recording the
-- source keeps a mined guess from reading as a measured fact. Additive: existing
-- rows default to GSC, which is what they are.

ALTER TABLE "seo_keywords" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'GSC';
ALTER TABLE "seo_keywords" ADD COLUMN IF NOT EXISTS "source_domain" TEXT;

CREATE INDEX IF NOT EXISTS "seo_keywords_property_id_source_idx" ON "seo_keywords"("property_id", "source");
