-- Why a task was moved into a status, kept ON THE PERIOD.
--
-- The reason used to live only on the task (hold_reason / discard_reason), which
-- holds the CURRENT one and is cleared the moment the task moves on. So the
-- Activity log could never answer "why was this on hold in June" once the work
-- resumed - the text was gone. Recording it per period makes the history keep
-- its own explanation.

ALTER TABLE "task_status_periods" ADD COLUMN "note" TEXT;

-- Backfill what is still recoverable: for tasks sitting ON HOLD or DISCARDED
-- right now, the task's reason belongs to its OPEN period. Closed periods are
-- unrecoverable - that text was already overwritten - and stay null, which the
-- UI renders as no reason rather than inventing one.
UPDATE "task_status_periods" p
SET "note" = t."hold_reason"
FROM "project_tasks" t
WHERE p."task_id" = t."id"
  AND p."ended_at" IS NULL
  AND p."status" = 'ON_HOLD'
  AND t."hold_reason" IS NOT NULL;

UPDATE "task_status_periods" p
SET "note" = t."discard_reason"
FROM "project_tasks" t
WHERE p."task_id" = t."id"
  AND p."ended_at" IS NULL
  AND p."status" = 'DISCARDED'
  AND t."discard_reason" IS NOT NULL;
