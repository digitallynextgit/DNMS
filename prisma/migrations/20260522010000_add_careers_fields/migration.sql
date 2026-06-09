-- Department: marketing-site careers metadata
ALTER TABLE "departments"
  ADD COLUMN IF NOT EXISTS "careers_tone" TEXT,
  ADD COLUMN IF NOT EXISTS "careers_jobs_label" TEXT;

-- JobPosting: rich content fields for the public careers page
ALTER TABLE "job_postings"
  ADD COLUMN IF NOT EXISTS "slug" TEXT,
  ADD COLUMN IF NOT EXISTS "meta" TEXT,
  ADD COLUMN IF NOT EXISTS "summary" TEXT,
  ADD COLUMN IF NOT EXISTS "intro" TEXT,
  ADD COLUMN IF NOT EXISTS "job_essence" TEXT,
  ADD COLUMN IF NOT EXISTS "key_requirements" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "current_openings" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "publish_to_careers" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "job_postings_publish_to_careers_status_idx"
  ON "job_postings" ("publish_to_careers", "status");
