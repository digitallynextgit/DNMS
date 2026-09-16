-- A calendar the CLIENT started, so the portal can let them delete it again.
--
-- createdById cannot answer this on its own: it is an Employee FK, so a
-- client-made calendar leaves it NULL - and so does anything the system makes.
-- "NULL means a client made it" would hand the portal a delete button over rows
-- nobody chose to give it.
ALTER TABLE "project_workbooks" ADD COLUMN "created_by_client_id" TEXT;

ALTER TABLE "project_workbooks"
  ADD CONSTRAINT "project_workbooks_created_by_client_id_fkey"
  FOREIGN KEY ("created_by_client_id") REFERENCES "client_users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "project_workbooks_created_by_client_id_idx"
  ON "project_workbooks"("created_by_client_id");

-- Backfill the calendars clients already made.
--
-- They were created before this column existed, so their only trace of an author
-- is the SHEET_CREATED event the service writes. Without this, a client who
-- started a calendar yesterday would find it undeletable today - which reads as
-- the feature being broken rather than as a missing column.
--
-- Narrow on purpose: created_by_id IS NULL keeps it off anything a staff member
-- made, and DISTINCT ON takes the earliest event per workbook so a workbook with
-- several tabs resolves to the person who started it.
UPDATE "project_workbooks" w
SET "created_by_client_id" = a."actor_client_id"
FROM (
  SELECT DISTINCT ON (s."workbook_id")
         s."workbook_id" AS workbook_id,
         e."actor_client_id"
  FROM "project_sheet_events" e
  JOIN "project_sheets" s ON s."id" = e."sheet_id"
  WHERE e."type" = 'SHEET_CREATED'
    AND e."actor_client_id" IS NOT NULL
  ORDER BY s."workbook_id", e."created_at" ASC
) a
WHERE w."id" = a.workbook_id
  AND w."created_by_id" IS NULL
  AND w."created_by_client_id" IS NULL;
