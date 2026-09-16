-- Made work may be owned by a TEAM rather than a named person.
--
-- ── WHAT THIS RELAXES, AND WHY ───────────────────────────────────────────────
-- 20260912000000 introduced unassigned rows and guarded them with:
--
--   "An unassigned row is only meaningful while nothing has been made yet, and
--    only if SOMEBODY owes it - which is the team. The moment it is delivered,
--    there is a maker, so the row must name one."
--
-- That held while every row was made by staff, who are always individuals. It
-- stopped holding when the client portal gained a Made button: a portal request
-- lands unassigned by design (the account manager routes it afterwards), so a
-- client recording that their own item exists had no way to say so - the row
-- they were describing was precisely the kind the constraint refused.
--
-- The invariant that actually mattered was ATTRIBUTION - no made row floating
-- free of anyone - and that is kept. What is dropped is the insistence that the
-- attribution be a PERSON: a row naming a team is still answerable for. So
-- "who made this" reads "the content team" rather than "nobody" on those rows,
-- and continues to read a person's name on everything staff mark themselves.
--
-- Every made row today (14 DELIVERED + 6 ACCEPTED) names a person and is
-- untouched; this only permits a shape that was previously impossible.

ALTER TABLE "project_deliverables"
    DROP CONSTRAINT IF EXISTS "project_deliverables_owner_check";

-- Somebody owns every row: a person, or failing that the team that owes it.
-- Both null is still refused - that is the case this constraint exists for.
ALTER TABLE "project_deliverables"
    ADD CONSTRAINT "project_deliverables_owner_check" CHECK (
        "employee_id" IS NOT NULL OR "team_id" IS NOT NULL
    );
