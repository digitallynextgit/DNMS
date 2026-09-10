-- Who OWNS a workbook (what the Calendars UI calls a "sheet"), as opposed to
-- created_by_id, which only records who started it. A sheet changes hands; its
-- author does not.
--
-- Hand-written (migrate dev cannot create a shadow DB here - P3014). Purely
-- additive and nullable, so every existing workbook stays valid as unassigned
-- and nothing needs a back-fill.

ALTER TABLE "project_workbooks" ADD COLUMN "assigned_to_id" TEXT;

CREATE INDEX "project_workbooks_assigned_to_id_idx" ON "project_workbooks"("assigned_to_id");

-- SET NULL, not CASCADE: an employee leaving the company must clear the owner,
-- never delete the team's calendar along with them.
ALTER TABLE "project_workbooks"
    ADD CONSTRAINT "project_workbooks_assigned_to_id_fkey"
    FOREIGN KEY ("assigned_to_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
