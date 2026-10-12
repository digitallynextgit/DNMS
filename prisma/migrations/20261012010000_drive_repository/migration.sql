-- Repository on the connected Google account's Drive, with nightly Backblaze backups. Additive, so
-- the live build keeps working before the new code is deployed. Hand-written; apply with
-- `npx prisma migrate deploy`.

-- Separate from drive_folder_id (the old Shared Drive), so switching storage back loses nothing.
ALTER TABLE "project_folders" ADD COLUMN IF NOT EXISTS "drive_mirror_id" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "project_folders_drive_mirror_id_key"
    ON "project_folders"("drive_mirror_id");

CREATE TABLE IF NOT EXISTS "drive_backups" (
    "tenant_id"          TEXT NOT NULL DEFAULT '0197d1ab-0000-7000-8000-000000000001',
    "id"                 TEXT NOT NULL,
    "drive_file_id"      TEXT NOT NULL,
    "project_id"         TEXT,
    "resource_id"        TEXT,
    "name"               TEXT NOT NULL,
    "mime_type"          TEXT NOT NULL,
    "size"               BIGINT NOT NULL,
    "b2_key"             TEXT NOT NULL,
    "source_modified_at" TIMESTAMP(3) NOT NULL,
    "backed_up_at"       TIMESTAMP(3) NOT NULL,
    "deleted_at"         TIMESTAMP(3),
    "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"         TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drive_backups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "drive_backups_drive_file_id_key" ON "drive_backups"("drive_file_id");
CREATE UNIQUE INDEX IF NOT EXISTS "drive_backups_b2_key_key" ON "drive_backups"("b2_key");
CREATE INDEX IF NOT EXISTS "drive_backups_tenant_id_idx" ON "drive_backups"("tenant_id");
CREATE INDEX IF NOT EXISTS "drive_backups_project_id_idx" ON "drive_backups"("project_id");

ALTER TABLE "drive_backups"
    ADD CONSTRAINT "drive_backups_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "drive_backup_runs" (
    "tenant_id"    TEXT NOT NULL DEFAULT '0197d1ab-0000-7000-8000-000000000001',
    "id"           TEXT NOT NULL,
    "run_date"     DATE NOT NULL,
    -- RUNNING | DONE | FAILED
    "status"       TEXT NOT NULL DEFAULT 'RUNNING',
    "checked"      INTEGER NOT NULL DEFAULT 0,
    "copied"       INTEGER NOT NULL DEFAULT 0,
    "bytes_copied" BIGINT NOT NULL DEFAULT 0,
    "failed"       INTEGER NOT NULL DEFAULT 0,
    "error"        TEXT,
    "started_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at"  TIMESTAMP(3),

    CONSTRAINT "drive_backup_runs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "drive_backup_runs_tenant_id_run_date_key"
    ON "drive_backup_runs"("tenant_id", "run_date");

ALTER TABLE "drive_backup_runs"
    ADD CONSTRAINT "drive_backup_runs_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
