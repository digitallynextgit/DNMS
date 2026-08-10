-- Manager approval for self-raised tasks is gone: people plan their own work
-- and start on it. Anything still queued for a manager is released as approved,
-- otherwise those tasks stay frozen forever now that nothing can approve them.
--
-- REJECTED rows are left alone: that is a decision somebody actually made, and
-- the reason on it still explains why the task is dead.
UPDATE "project_tasks"
SET "approval_status" = 'APPROVED'
WHERE "approval_status" = 'PENDING_APPROVAL';
