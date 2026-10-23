-- Fixed calendar columns: a template key and lock flag per column, and per-row reminder stamps.
-- Additive, so the live build keeps working before the new code is deployed. Hand-written; apply
-- with `npx prisma migrate deploy`.

ALTER TABLE "project_sheet_columns" ADD COLUMN IF NOT EXISTS "key" TEXT;
ALTER TABLE "project_sheet_columns" ADD COLUMN IF NOT EXISTS "locked" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "project_sheet_rows" ADD COLUMN IF NOT EXISTS "reminders" JSONB;

CREATE INDEX IF NOT EXISTS "project_sheet_columns_sheet_id_key_idx"
    ON "project_sheet_columns"("sheet_id", "key");
