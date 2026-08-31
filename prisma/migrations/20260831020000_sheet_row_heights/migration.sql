-- Per-row heights for project sheets.
--
-- Hand-written (migrate dev cannot create a shadow DB here - P3014), additive,
-- and safe to apply while the previous build is serving.
--
-- Keyed by row POSITION on the sheet rather than stored on each row: a row only
-- becomes a database row once something is typed into it, and dragging an empty
-- row taller has to work before that. Column widths need no equivalent - a
-- column always exists, so its width lives on the column.
ALTER TABLE "project_sheets"
    ADD COLUMN IF NOT EXISTS "row_heights" JSONB;
