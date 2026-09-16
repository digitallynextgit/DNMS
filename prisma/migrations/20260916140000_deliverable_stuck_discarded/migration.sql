-- Two new deliverable statuses: STUCK (blocked, still owed) and DISCARDED
-- (dropped without being made), each carrying a reason.
--
-- Hand-written to match the rest of this folder. Purely additive.
--
-- ── WHY THIS IS SPLIT ACROSS TWO MIGRATIONS ──────────────────────────────────
-- Postgres will let `ALTER TYPE ... ADD VALUE` run inside a transaction, but the
-- new label cannot be USED until that transaction commits - and Prisma runs each
-- migration file in one transaction. The CHECK constraints that have to be
-- widened all reference the new labels by name, so they cannot live here. They
-- are in 20260916140100_deliverable_stuck_discarded_checks, which runs next.
--
-- Until that second file runs, the enum values exist but no row can legally hold
-- them (see the constraints there). The pair must be deployed together.

ALTER TYPE "DeliverableStatus" ADD VALUE IF NOT EXISTS 'STUCK';
ALTER TYPE "DeliverableStatus" ADD VALUE IF NOT EXISTS 'DISCARDED';

-- The CURRENT reason, beside acceptance_note which does the same job for the
-- client's sign-off. The per-transition history is already on
-- project_deliverable_events; this exists so a list can show "Stuck: waiting on
-- footage" without joining events once per row.
--
-- No CHECK forcing it to be present for STUCK/DISCARDED: the requirement is
-- expressed in the transition table (features/projects/lib/deliverable-lifecycle.ts,
-- `needs: ["reason"]`), which is the same mechanism REJECTED already uses and the
-- one place both the server and the buttons read the rule from.
ALTER TABLE "project_deliverables" ADD COLUMN IF NOT EXISTS "status_reason" TEXT;
