-- Putting a task ON_HOLD now books its unfinished hours onto a follow-up task
-- dated for the day the work is expected to resume. This column links the
-- follow-up back to the task it came from.
--
-- It is also what keeps the spawn idempotent: a task held, resumed and held
-- again finds its existing open follow-up and updates it, instead of leaving a
-- trail of duplicates on the board.
--
-- SetNull rather than Cascade: deleting the held task must not delete the
-- follow-up, because the remaining hours now live on the follow-up.

ALTER TABLE "project_tasks" ADD COLUMN "resumed_from_id" TEXT;

CREATE INDEX "project_tasks_resumed_from_id_idx" ON "project_tasks"("resumed_from_id");

ALTER TABLE "project_tasks"
    ADD CONSTRAINT "project_tasks_resumed_from_id_fkey"
    FOREIGN KEY ("resumed_from_id") REFERENCES "project_tasks"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
