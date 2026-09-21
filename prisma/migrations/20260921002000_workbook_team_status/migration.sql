-- Where a team's month stands, on the calendar plan.
--
-- Hand-written to match the rest of this folder. Purely additive.
--
-- ── WHY A NEW ENUM AND NOT DeliverableStatus ─────────────────────────────────
-- DeliverableStatus carries ACCEPTED and REJECTED, which are the CLIENT's
-- verdict on a thing that was made. A calendar plan row never reaches a client
-- and has no verdict to record; reusing that type would have put two states on
-- every dropdown that can never be chosen. The five here are the ones a team
-- actually moves through, and each name is taken from the vocabulary the app
-- already uses (TODO / IN_PROGRESS / DONE from ProjectTask, STUCK and
-- DISCARDED from DeliverableStatus) so nobody has to learn a second dialect.

DO $$
BEGIN
    CREATE TYPE "WorkbookTeamStatus" AS ENUM (
        'TODO', 'IN_PROGRESS', 'DONE', 'STUCK', 'DISCARDED'
    );
EXCEPTION
    -- CREATE TYPE has no IF NOT EXISTS, and this folder's migrations are
    -- written to be safe to re-run.
    WHEN duplicate_object THEN NULL;
END $$;

-- DEFAULT 'TODO', which is also the right answer for every row that already
-- exists: a plan written before there was a status is a plan nobody has
-- reported progress on. No backfill can say more than that honestly.
ALTER TABLE "project_workbook_teams"
    ADD COLUMN IF NOT EXISTS "status" "WorkbookTeamStatus" NOT NULL DEFAULT 'TODO';

-- "What is still owed" - the read behind every roll-up of a month.
CREATE INDEX IF NOT EXISTS "project_workbook_teams_status_idx"
    ON "project_workbook_teams"("status");

-- ── NO CHECK TYING status TO THE HANDED-IN COUNT ─────────────────────────────
-- The rule that DONE needs at least `quantity` links and files between them is
-- enforced in the service, not here, and deliberately so: the count spans this
-- table's `links` array AND a COUNT over project_resources, which a row-level
-- CHECK cannot see. A trigger could, at the cost of making every file upload
-- re-derive a status. The service is the one place both numbers are already in
-- hand.
