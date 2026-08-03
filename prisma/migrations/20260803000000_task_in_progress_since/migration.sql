-- Tracks when a task entered IN_PROGRESS so elapsed time can be accumulated into
-- logged_hours when it leaves that status. NULL means the clock is not running.
ALTER TABLE "project_tasks" ADD COLUMN "in_progress_since" TIMESTAMP(3);

-- Tasks already sitting in IN_PROGRESS have no start instant on record. Start
-- their clock now rather than backdating time nobody measured.
UPDATE "project_tasks" SET "in_progress_since" = NOW() WHERE "status" = 'IN_PROGRESS';
