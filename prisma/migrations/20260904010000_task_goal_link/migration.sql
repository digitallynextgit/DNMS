-- Link tasks to the goal they serve, and flag whether output is expected.
--
-- Hand-written (migrate dev cannot create a shadow DB here - P3014), additive
-- only, and safe to apply while the previous build is serving: both columns
-- are nullable-or-defaulted, so rows written by the old code stay valid.
--
-- goal_id is what turns a goal's progress from a checkbox into a derivation:
-- a goal with linked tasks is done / countable of them. SET NULL on delete -
-- removing a goal must not remove the work that was done for it.
--
-- produces_output defaults TRUE. Existing tasks keep it, which means the
-- "completed with no output logged" nudge will name historical tasks too; that
-- is honest (they produced things nobody recorded) and it costs nothing, since
-- the nudge is a count on the manager's view, never a block.
ALTER TABLE "project_tasks"
    ADD COLUMN IF NOT EXISTS "goal_id" TEXT,
    ADD COLUMN IF NOT EXISTS "produces_output" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS "project_tasks_goal_id_idx" ON "project_tasks"("goal_id");

ALTER TABLE "project_tasks"
    ADD CONSTRAINT "project_tasks_goal_id_fkey"
    FOREIGN KEY ("goal_id") REFERENCES "project_goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
