-- Readable album URLs: /gallery/diwali-2026 instead of /gallery/<uuid>.
--
-- Added nullable, backfilled from the title, then made NOT NULL + UNIQUE, so
-- existing albums keep working instead of the migration failing on them.
ALTER TABLE "photo_albums" ADD COLUMN "slug" TEXT;

-- slugify(title): lowercase, non-alphanumerics collapsed to "-", edges trimmed.
-- Collisions get "-2", "-3"… by row_number, matching generateAlbumSlug().
WITH slugged AS (
  SELECT
    id,
    NULLIF(trim(BOTH '-' FROM regexp_replace(lower(title), '[^a-z0-9]+', '-', 'g')), '') AS base,
    row_number() OVER (
      PARTITION BY NULLIF(trim(BOTH '-' FROM regexp_replace(lower(title), '[^a-z0-9]+', '-', 'g')), '')
      ORDER BY created_at
    ) AS n
  FROM "photo_albums"
)
UPDATE "photo_albums" a
SET "slug" = CASE
  -- A title with no usable characters at all falls back to the id.
  WHEN s.base IS NULL THEN a.id
  WHEN s.n = 1 THEN s.base
  ELSE s.base || '-' || s.n
END
FROM slugged s
WHERE s.id = a.id;

ALTER TABLE "photo_albums" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "photo_albums_slug_key" ON "photo_albums"("slug");
