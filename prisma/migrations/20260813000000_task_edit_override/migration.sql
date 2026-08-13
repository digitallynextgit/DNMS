-- Per-employee override of the 15-minute task edit window.
--
-- Normally whoever raised a task may correct it for 15 minutes and no longer;
-- after that only the team manager can. That is right for a commitment other
-- people plan around, and wrong when somebody has to write up a day they forgot
-- to fill in, or fix last week's sheet.
--
-- HR/admin can lift the window for one person from their profile. The grant is
-- attributable on purpose - a standing bypass of a control that nobody can trace
-- back to a decision is how the control quietly stops meaning anything.

ALTER TABLE "employees"
    ADD COLUMN "can_edit_past_tasks"             BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "past_task_access_granted_at"     TIMESTAMP(3),
    ADD COLUMN "past_task_access_granted_by_id"  TEXT;

-- SetNull: the grant survives the granter leaving. Losing the audit trail would
-- be worse than pointing at a departed employee.
ALTER TABLE "employees"
    ADD CONSTRAINT "employees_past_task_access_granted_by_id_fkey"
    FOREIGN KEY ("past_task_access_granted_by_id") REFERENCES "employees"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
