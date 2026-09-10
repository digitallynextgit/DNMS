-- Owed work can belong to a TEAM before it belongs to a person.
--
-- The account manager says "the video team owes four reels this week"; the team
-- manager decides who makes them. Until now employee_id was NOT NULL and the
-- form defaulted it to whoever was clicking, so that first step had nowhere to
-- live and the two-step handoff collapsed into one.
--
-- Hand-written (migrate dev cannot create a shadow DB here - P3014). Additive:
-- every existing row already has an employee and keeps it.

ALTER TABLE "project_deliverables" ALTER COLUMN "employee_id" DROP NOT NULL;

-- An unassigned row is only meaningful while nothing has been made yet, and
-- only if SOMEBODY owes it - which is the team. The moment it is delivered,
-- there is a maker, so the row must name one.
ALTER TABLE "project_deliverables"
    ADD CONSTRAINT "project_deliverables_owner_check"
    CHECK (
        "employee_id" IS NOT NULL
        OR ("status" IN ('PLANNED', 'IN_PROGRESS') AND "team_id" IS NOT NULL)
    );

-- Finding "what does this team still owe" is now a first-class question.
CREATE INDEX "project_deliverables_team_id_status_idx"
    ON "project_deliverables"("team_id", "status");
