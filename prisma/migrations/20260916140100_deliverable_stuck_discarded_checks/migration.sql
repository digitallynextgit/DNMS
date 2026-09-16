-- Widen the two CHECK constraints that would otherwise REJECT every STUCK and
-- DISCARDED row. Runs after 20260916140000, which adds the enum labels - a
-- constraint cannot name a label added in its own transaction.
--
-- Both constraints were written as "PLANNED or IN_PROGRESS, else ...", which was
-- an accurate way to say "not finished yet" when those were the only two
-- unfinished states. They are no longer, so both lists are restated.

-- ── completed_on ─────────────────────────────────────────────────────────────
-- A row that is not finished has no day it counts for. STUCK never has one (it
-- is blocked), and DISCARDED never has one (it was dropped, not completed) - so
-- without this, setting either status on a row fails outright.
ALTER TABLE "project_deliverables"
    DROP CONSTRAINT IF EXISTS "project_deliverables_completed_on_by_status";
ALTER TABLE "project_deliverables"
    ADD CONSTRAINT "project_deliverables_completed_on_by_status" CHECK (
        "status" IN ('PLANNED', 'IN_PROGRESS', 'STUCK', 'DISCARDED')
        OR "completed_on" IS NOT NULL
    );

-- ── owner ────────────────────────────────────────────────────────────────────
-- Unassigned work is allowed only while nobody has made it yet. A client's
-- portal request lands unassigned by design (the account manager routes it
-- afterwards), so a client marking their own unassigned row STUCK would have hit
-- this constraint on the very first use.
ALTER TABLE "project_deliverables"
    DROP CONSTRAINT IF EXISTS "project_deliverables_owner_check";
ALTER TABLE "project_deliverables"
    ADD CONSTRAINT "project_deliverables_owner_check" CHECK (
        "employee_id" IS NOT NULL
        OR ("status" IN ('PLANNED', 'IN_PROGRESS', 'STUCK', 'DISCARDED') AND "team_id" IS NOT NULL)
    );
