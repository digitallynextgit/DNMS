-- Calendars in the client portal: a workbook a client may see and fill.
--
-- Hand-written to match the rest of this folder. Purely additive.
--
-- ── WHY is_client_visible DEFAULTS TO FALSE ──────────────────────────────────
-- A project's calendars are not all client-facing: alongside the content plan
-- sit internal ideas sheets and working notes. The portal module would publish
-- every one of them the moment it was granted, so the flag is not an extra on
-- top of the feature - it IS the feature. Same reasoning, and the same default,
-- as project_resources.is_client_visible.
--
-- Existing calendars therefore all stay internal, which is the only safe
-- backfill: a sheet becomes visible because somebody ticked a box, never
-- because a migration ran.

ALTER TABLE "project_workbooks"
    ADD COLUMN IF NOT EXISTS "is_client_visible" BOOLEAN NOT NULL DEFAULT false;

-- The portal's list: this project's SHARED calendars only.
CREATE INDEX IF NOT EXISTS "project_workbooks_project_id_is_client_visible_idx"
    ON "project_workbooks"("project_id", "is_client_visible");

-- ── WHO EDITED A CELL ────────────────────────────────────────────────────────
-- actor_id is an EMPLOYEE foreign key, and a portal client is not an employee -
-- writing their id there would either break the constraint or credit the edit
-- to a staff member who never made it. The pattern for this already exists
-- twice in the schema (project_deliverable_events.actor_client_id,
-- project_resources.uploaded_by_client_id), so this follows it.
--
-- No CHECK requiring exactly one actor: a row with neither is a SYSTEM write,
-- which this table already permitted and which the sheet importer produces.
ALTER TABLE "project_sheet_events"
    ADD COLUMN IF NOT EXISTS "actor_client_id" TEXT;

-- SET NULL, not CASCADE: a calendar's history outlives the portal account that
-- made an edit. Losing the attribution is acceptable; losing the edit is not.
ALTER TABLE "project_sheet_events"
    ADD CONSTRAINT "project_sheet_events_actor_client_id_fkey"
    FOREIGN KEY ("actor_client_id") REFERENCES "client_users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
