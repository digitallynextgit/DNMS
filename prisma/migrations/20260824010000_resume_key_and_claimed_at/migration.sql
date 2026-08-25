-- API-07: store the B2 object key for an applicant CV alongside the signed url.
--
-- `resume_url` holds a SIGNED url. B2 caps a signature at 7 days regardless of
-- the requested lifetime, so a link minted with a one-year expiry still 403s
-- after a week and the CV becomes unreachable. The object key is stable, so a
-- fresh signed url is generated on read instead. It also lets the storage
-- orphan-scan match CVs on an exact key rather than `resume_url LIKE %key%`.
ALTER TABLE "applicants" ADD COLUMN IF NOT EXISTS "resume_key" TEXT;

-- API-08: record when a campaign send row was CLAIMED (PENDING -> SENDING).
--
-- requeueStuckSends measured staleness from `created_at`, but a bulk campaign
-- inserts every send row in one go, so they all share a created_at. Once a run
-- passed the stuck threshold, every row still in flight looked stale and was
-- flipped back to PENDING while it was actively sending - delivering the
-- campaign twice to those recipients.
ALTER TABLE "project_campaign_sends" ADD COLUMN IF NOT EXISTS "claimed_at" TIMESTAMP(3);

-- Backfill so existing in-flight rows are not treated as claimed-at-null and
-- therefore never requeued. created_at is the best available approximation for
-- rows that predate the column.
UPDATE "project_campaign_sends"
SET "claimed_at" = "created_at"
WHERE "status" = 'SENDING' AND "claimed_at" IS NULL;

-- Supports the requeue sweep's (status, claimed_at) predicate.
CREATE INDEX IF NOT EXISTS "project_campaign_sends_status_claimed_at_idx"
  ON "project_campaign_sends"("status", "claimed_at");
