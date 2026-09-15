-- Staff can review a CLIENT-uploaded asset.
--
-- Hand-written (P3014), additive: one nullable column and its FK.
--
-- Closing a dead end. The client review loop shipped with only a client-side
-- reviewer, and a client cannot approve their own upload - that rule is the
-- point of having a review at all. So a file the client uploaded had nobody who
-- could move it out of IN_REVIEW, and it would have sat there for good.
--
-- Mirrors the uploaded_by_id / uploaded_by_client_id pair: staff and portal
-- accounts live in different tables, so one column cannot hold both actors.
-- SET NULL like every other actor FK here - a file outlives the reviewer.

ALTER TABLE "project_resources" ADD COLUMN IF NOT EXISTS "reviewed_by_id" TEXT;

ALTER TABLE "project_resources"
    ADD CONSTRAINT "project_resources_reviewed_by_id_fkey"
    FOREIGN KEY ("reviewed_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
