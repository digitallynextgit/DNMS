-- Project sheets: a spreadsheet whose COLUMNS the team defines.
--
-- Hand-written (migrate dev cannot create a shadow DB here - P3014), purely
-- additive, and safe to apply while the previous build is serving: nothing
-- existing reads or writes these tables.

-- 1. Vocabularies. Mirrored in features/projects/lib/sheet-types.ts.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SheetColumnType') THEN
        CREATE TYPE "SheetColumnType" AS ENUM (
            'TEXT', 'LONG_TEXT', 'NUMBER', 'DATE', 'SELECT', 'CHECKBOX', 'URL', 'PERSON'
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SheetEventType') THEN
        CREATE TYPE "SheetEventType" AS ENUM (
            'SHEET_CREATED', 'SHEET_RENAMED', 'COLUMN_ADDED', 'COLUMN_UPDATED',
            'COLUMN_DELETED', 'ROW_ADDED', 'CELL_UPDATED', 'ROW_DELETED'
        );
    END IF;
END
$$;

-- 2. The sheet. Several per project, like tabs in a workbook.
CREATE TABLE IF NOT EXISTS "project_sheets" (
    "tenant_id"     TEXT NOT NULL DEFAULT '0197d1ab-0000-7000-8000-000000000001',
    "id"            TEXT NOT NULL,
    "project_id"    TEXT NOT NULL,
    "name"          TEXT NOT NULL,
    "description"   TEXT,
    "position"      INTEGER NOT NULL DEFAULT 0,
    "created_by_id" TEXT,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "project_sheets_pkey" PRIMARY KEY ("id")
);

-- 3. Columns. The team's own, not this schema's.
CREATE TABLE IF NOT EXISTS "project_sheet_columns" (
    "tenant_id"  TEXT NOT NULL DEFAULT '0197d1ab-0000-7000-8000-000000000001',
    "id"         TEXT NOT NULL,
    "sheet_id"   TEXT NOT NULL,
    "name"       TEXT NOT NULL,
    "type"       "SheetColumnType" NOT NULL DEFAULT 'TEXT',
    "position"   INTEGER NOT NULL DEFAULT 0,
    "width"      INTEGER,
    "options"    JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "project_sheet_columns_pkey" PRIMARY KEY ("id")
);

-- 4. Rows. Cells are one JSON blob keyed by column id - see the model comment.
CREATE TABLE IF NOT EXISTS "project_sheet_rows" (
    "tenant_id"     TEXT NOT NULL DEFAULT '0197d1ab-0000-7000-8000-000000000001',
    "id"            TEXT NOT NULL,
    "sheet_id"      TEXT NOT NULL,
    "position"      INTEGER NOT NULL DEFAULT 0,
    "cells"         JSONB NOT NULL DEFAULT '{}',
    "created_by_id" TEXT,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "project_sheet_rows_pkey" PRIMARY KEY ("id")
);

-- 5. The change log. Append-only.
--
--    row_id and column_id carry NO foreign key on purpose: the event that
--    matters most is the one recording a deletion, and an FK would cascade it
--    away together with the row it describes.
CREATE TABLE IF NOT EXISTS "project_sheet_events" (
    "tenant_id"  TEXT NOT NULL DEFAULT '0197d1ab-0000-7000-8000-000000000001',
    "id"         TEXT NOT NULL,
    "sheet_id"   TEXT NOT NULL,
    "row_id"     TEXT,
    "column_id"  TEXT,
    "type"       "SheetEventType" NOT NULL,
    "label"      TEXT,
    "before"     JSONB,
    "after"      JSONB,
    "actor_id"   TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_sheet_events_pkey" PRIMARY KEY ("id")
);

-- 6. Indexes.
CREATE UNIQUE INDEX IF NOT EXISTS "project_sheets_project_id_name_key" ON "project_sheets"("project_id", "name");
CREATE INDEX IF NOT EXISTS "project_sheets_project_id_idx"             ON "project_sheets"("project_id");
CREATE INDEX IF NOT EXISTS "project_sheets_tenant_id_idx"              ON "project_sheets"("tenant_id");
CREATE INDEX IF NOT EXISTS "project_sheet_columns_sheet_id_position_idx" ON "project_sheet_columns"("sheet_id", "position");
CREATE INDEX IF NOT EXISTS "project_sheet_columns_tenant_id_idx"         ON "project_sheet_columns"("tenant_id");
CREATE INDEX IF NOT EXISTS "project_sheet_rows_sheet_id_position_idx"    ON "project_sheet_rows"("sheet_id", "position");
CREATE INDEX IF NOT EXISTS "project_sheet_rows_tenant_id_idx"            ON "project_sheet_rows"("tenant_id");
CREATE INDEX IF NOT EXISTS "project_sheet_events_sheet_id_created_at_idx" ON "project_sheet_events"("sheet_id", "created_at");
CREATE INDEX IF NOT EXISTS "project_sheet_events_tenant_id_idx"           ON "project_sheet_events"("tenant_id");

-- 7. Foreign keys.
ALTER TABLE "project_sheets"
    ADD CONSTRAINT "project_sheets_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_sheets"
    ADD CONSTRAINT "project_sheets_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "project_sheet_columns"
    ADD CONSTRAINT "project_sheet_columns_sheet_id_fkey"
    FOREIGN KEY ("sheet_id") REFERENCES "project_sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_sheet_rows"
    ADD CONSTRAINT "project_sheet_rows_sheet_id_fkey"
    FOREIGN KEY ("sheet_id") REFERENCES "project_sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_sheet_rows"
    ADD CONSTRAINT "project_sheet_rows_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "project_sheet_events"
    ADD CONSTRAINT "project_sheet_events_sheet_id_fkey"
    FOREIGN KEY ("sheet_id") REFERENCES "project_sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_sheet_events"
    ADD CONSTRAINT "project_sheet_events_actor_id_fkey"
    FOREIGN KEY ("actor_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
