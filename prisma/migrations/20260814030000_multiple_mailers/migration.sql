-- Multiple SMTP accounts per project, chosen per campaign.
--
-- One account per project was too rigid: a project routinely needs a
-- transactional sender and a newsletter sender on different domains or
-- different providers, and mixing them means a bounced newsletter damages
-- delivery of the transactional mail.

-- 1. Label each account. Existing rows are named after their sender so the
--    picker has something meaningful rather than "Untitled".
ALTER TABLE "project_mailers" ADD COLUMN "name" TEXT;
UPDATE "project_mailers" SET "name" = COALESCE(NULLIF("from_name", ''), 'Default') WHERE "name" IS NULL;
ALTER TABLE "project_mailers" ALTER COLUMN "name" SET NOT NULL;

-- 2. Drop one-per-project; names are unique within a project instead.
DROP INDEX IF EXISTS "project_mailers_project_id_key";
CREATE INDEX "project_mailers_project_id_idx" ON "project_mailers"("project_id");
CREATE UNIQUE INDEX "project_mailers_project_id_name_key" ON "project_mailers"("project_id", "name");

-- 3. Campaigns record WHICH account they send from, snapshotted at queue time.
--    SET NULL on delete: removing an account must not delete the history of what
--    it sent, and the runner treats a null mailer as a hard failure rather than
--    silently falling back to some other account.
ALTER TABLE "project_campaigns" ADD COLUMN "mailer_id" TEXT;
ALTER TABLE "project_campaigns" ADD CONSTRAINT "project_campaigns_mailer_id_fkey"
  FOREIGN KEY ("mailer_id") REFERENCES "project_mailers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Existing campaigns predate the column; point them at their project's only
-- account so their history still names a sender.
UPDATE "project_campaigns" c
SET "mailer_id" = m."id"
FROM "project_mailers" m
WHERE c."project_id" = m."project_id" AND c."mailer_id" IS NULL;
