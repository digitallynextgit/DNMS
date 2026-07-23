-- Turn content-calendar rows into real, reminded work: an entry can now carry an
-- assignee and mirror itself as a ProjectTask on that person's board.
-- Purely additive - three nullable columns on an existing table, no backfill and
-- no change to how existing rows behave.

ALTER TABLE "content_calendar_entries" ADD COLUMN IF NOT EXISTS "assignee_id" TEXT;
ALTER TABLE "content_calendar_entries" ADD COLUMN IF NOT EXISTS "task_id" TEXT;
ALTER TABLE "content_calendar_entries" ADD COLUMN IF NOT EXISTS "reminded_at" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "content_calendar_entries_task_id_key" ON "content_calendar_entries"("task_id");
CREATE INDEX IF NOT EXISTS "content_calendar_entries_assignee_id_idx" ON "content_calendar_entries"("assignee_id");
CREATE INDEX IF NOT EXISTS "content_calendar_entries_date_status_idx" ON "content_calendar_entries"("date", "status");

-- SET NULL on both: losing an employee or a task must never delete the client's
-- content plan.
DO $$ BEGIN
    ALTER TABLE "content_calendar_entries" ADD CONSTRAINT "content_calendar_entries_assignee_id_fkey"
        FOREIGN KEY ("assignee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "content_calendar_entries" ADD CONSTRAINT "content_calendar_entries_task_id_fkey"
        FOREIGN KEY ("task_id") REFERENCES "project_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
