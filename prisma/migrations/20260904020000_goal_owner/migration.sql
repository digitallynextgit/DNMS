-- A goal has an OWNER: the person accountable for it landing.
--
-- Hand-written (migrate dev cannot create a shadow DB here - P3014), additive
-- only, nullable: existing goals default to "the account manager", which is
-- what null reads as everywhere the owner is shown.
--
-- Distinct from created_by (who typed the row) and from the tasks' assignees
-- (who does the work). This is the line of sight from a promise to a name.
ALTER TABLE "project_goals"
    ADD COLUMN IF NOT EXISTS "owner_id" TEXT;

CREATE INDEX IF NOT EXISTS "project_goals_owner_id_idx" ON "project_goals"("owner_id");

ALTER TABLE "project_goals"
    ADD CONSTRAINT "project_goals_owner_id_fkey"
    FOREIGN KEY ("owner_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
