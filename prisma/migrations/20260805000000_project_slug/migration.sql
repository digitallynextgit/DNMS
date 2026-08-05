-- Project slug: human-readable URL identifier (/projects/rudione-leocym).
-- Nullable + unique so existing rows stay valid and the app can fall back to the id.
ALTER TABLE "projects" ADD COLUMN "slug" TEXT;

-- Backfill from the name, matching lib/utils.ts slugify(): lowercase, every run of
-- non-alphanumerics becomes a single "-", no leading/trailing "-".
UPDATE "projects"
SET "slug" = trim(both '-' from regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g'))
WHERE "slug" IS NULL;

-- Any collision (two projects sharing a name) keeps the oldest clean slug and
-- suffixes the rest with their unique code, so the unique index below can be created.
UPDATE "projects" p
SET "slug" = p."slug" || '-' || lower(p."code")
FROM (
  SELECT "id", row_number() OVER (PARTITION BY "slug" ORDER BY "created_at") AS rn
  FROM "projects"
) d
WHERE d."id" = p."id" AND d.rn > 1;

-- An empty slug (a name with no alphanumerics at all) is useless as a URL - fall
-- back to the code rather than storing "".
UPDATE "projects" SET "slug" = lower("code") WHERE "slug" = '';

CREATE UNIQUE INDEX "projects_slug_key" ON "projects"("slug");
