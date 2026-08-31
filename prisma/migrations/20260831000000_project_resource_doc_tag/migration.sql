-- Document tags on project files.
--
-- Hand-written (migrate dev cannot create a shadow DB here - P3014), additive
-- only, and safe to apply while the previous build is serving: the column is
-- nullable, so rows written by the old code stay valid.
--
-- Nullable rather than DEFAULT 'OTHER' on purpose. NULL means "never
-- classified"; OTHER means "classified, and it is genuinely none of these".
-- Collapsing the two would make it impossible to find the backlog later.

-- 1. The vocabulary. Mirrors DOC_TAGS in features/projects/lib/doc-tag.ts.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DocTag') THEN
        CREATE TYPE "DocTag" AS ENUM (
            'BRAND', 'STRATEGY', 'RESEARCH', 'JOURNEY', 'REPORT',
            'CREATIVE', 'VIDEO', 'PRODUCT', 'LEGAL', 'OTHER'
        );
    END IF;
END
$$;

-- 2. The column.
ALTER TABLE "project_resources"
    ADD COLUMN IF NOT EXISTS "tag" "DocTag";

-- 3. The Files tab filters on it, so it earns its index.
CREATE INDEX IF NOT EXISTS "project_resources_tag_idx"
    ON "project_resources"("tag");
