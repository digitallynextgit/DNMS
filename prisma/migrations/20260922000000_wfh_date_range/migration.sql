-- ─── WFH requests: a request now covers a RANGE of working days ──────────────
-- `date` keeps its name and becomes the first day of the range; `end_date` is
-- the last day. Both are inclusive. Every existing row is a single day, so it
-- backfills to end_date = date and total_days = 1 (the column default).

ALTER TABLE "wfh_requests" ADD COLUMN IF NOT EXISTS "end_date"   DATE;
ALTER TABLE "wfh_requests" ADD COLUMN IF NOT EXISTS "total_days" INTEGER NOT NULL DEFAULT 1;

UPDATE "wfh_requests" SET "end_date" = "date" WHERE "end_date" IS NULL;

-- NOT NULL (rather than a nullable column meaning "single day") so every range
-- query stays a plain `date <= x AND end_date >= y`. There is no usable column
-- default for it, so this migration and the matching build must ship together.
ALTER TABLE "wfh_requests" ALTER COLUMN "end_date" SET NOT NULL;

-- Range lookups, mirroring leave_requests(start_date, end_date). The composite
-- also serves the date-prefix queries the old single-column index handled.
CREATE INDEX IF NOT EXISTS "wfh_requests_date_end_date_idx" ON "wfh_requests"("date", "end_date");
DROP INDEX IF EXISTS "wfh_requests_date_idx";

-- ─── Duplicate guard: same-day UNIQUE → overlapping-range EXCLUDE ────────────
-- 20260824000000_perf_indexes guarded duplicates with a partial
-- UNIQUE (employee_id, date) WHERE status IN ('PENDING','APPROVED'). Now that a
-- request spans days, two active requests can overlap without sharing a start
-- date (Sep 22-24 vs Sep 23), which that index cannot see. An EXCLUDE over the
-- daterange catches every overlap, and stays partial so re-applying after a
-- REJECTED/CANCELLED request is still allowed.
--
-- `employee_id WITH =` needs btree_gist. Some managed roles cannot create
-- extensions, so the whole swap is best-effort: on failure we keep the old
-- unique index and rely on the service-level overlap check, rather than failing
-- the migration and blocking the rest of it.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS btree_gist;

  ALTER TABLE "wfh_requests"
    ADD CONSTRAINT "wfh_requests_no_active_overlap"
    EXCLUDE USING gist (
      "employee_id" WITH =,
      daterange("date", "end_date", '[]') WITH &&
    ) WHERE ("status" IN ('PENDING', 'APPROVED'));

  -- Only once the stronger guard is actually in place.
  DROP INDEX IF EXISTS "wfh_requests_employee_id_date_active_key";
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'wfh_requests_no_active_overlap already exists - nothing to do';
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not add the WFH overlap EXCLUDE (%). Keeping the single-day unique index; overlaps are still rejected by the application check.', SQLERRM;
END $$;
