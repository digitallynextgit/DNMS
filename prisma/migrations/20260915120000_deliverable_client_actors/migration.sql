-- A client can plan, finalise and send back work on the deliverables ledger.
--
-- Hand-written (migrate dev cannot create a shadow DB here - P3014). Purely
-- additive: three nullable columns and their foreign keys. Every existing row
-- is untouched and stays exactly as valid as it was.
--
-- ── WHY THE EVENT TABLE NEEDS A COLUMN TOO ───────────────────────────────────
-- project_deliverable_events.actor_id is a foreign key to employees. A client
-- id written there is a constraint violation, and writing NULL instead would
-- lose the attribution the append-only log exists to keep. So the log gets the
-- same pair of columns the row does: whoever acted, in the right table.

-- Who planned it, and who gave it the client's verdict.
ALTER TABLE "project_deliverables" ADD COLUMN IF NOT EXISTS "logged_by_client_id" TEXT;
ALTER TABLE "project_deliverables" ADD COLUMN IF NOT EXISTS "accepted_by_client_id" TEXT;

-- Who did the thing the event records.
ALTER TABLE "project_deliverable_events" ADD COLUMN IF NOT EXISTS "actor_client_id" TEXT;

-- ── NO "EXACTLY ONE ACTOR" CHECK HERE ────────────────────────────────────────
-- project_resources carries one, because uploaded_by_id was mandatory before
-- clients could upload, so every row genuinely has an uploader. Here
-- logged_by_id has always been nullable and live rows legitimately have neither
-- actor - imported history, rows whose logger was deleted. A constraint
-- demanding one would fail on data that is already correct.

-- SET NULL throughout: work outlives the account that touched it, and losing a
-- deliverable because a portal login was removed would be far worse than losing
-- the name attached to it.
ALTER TABLE "project_deliverables"
    ADD CONSTRAINT "project_deliverables_logged_by_client_id_fkey"
    FOREIGN KEY ("logged_by_client_id") REFERENCES "client_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "project_deliverables"
    ADD CONSTRAINT "project_deliverables_accepted_by_client_id_fkey"
    FOREIGN KEY ("accepted_by_client_id") REFERENCES "client_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "project_deliverable_events"
    ADD CONSTRAINT "project_deliverable_events_actor_client_id_fkey"
    FOREIGN KEY ("actor_client_id") REFERENCES "client_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
