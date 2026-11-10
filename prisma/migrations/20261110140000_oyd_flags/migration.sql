-- OYD (Own Your Deadline) flags: one row per flag on an employee, kept after removal for history.
-- Additive, so the live build keeps working before the new code is deployed.
-- Hand-written; apply with `npx prisma migrate deploy`.

CREATE TABLE IF NOT EXISTS "oyd_flags" (
    "tenant_id"      TEXT NOT NULL DEFAULT '0197d1ab-0000-7000-8000-000000000001',
    "id"             TEXT NOT NULL,
    "employee_id"    TEXT NOT NULL,
    "raised_by_id"   TEXT,
    "category"       TEXT NOT NULL,
    "note"           TEXT NOT NULL,
    "status"         TEXT NOT NULL DEFAULT 'PENDING',
    "level"          INTEGER,
    "reviewed_by_id" TEXT,
    "reviewed_at"    TIMESTAMP(3),
    "review_note"    TEXT,
    "removed_by_id"  TEXT,
    "removed_at"     TIMESTAMP(3),
    "remove_reason"  TEXT,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oyd_flags_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "oyd_flags_employee_id_status_idx" ON "oyd_flags"("employee_id", "status");
CREATE INDEX IF NOT EXISTS "oyd_flags_raised_by_id_idx" ON "oyd_flags"("raised_by_id");
CREATE INDEX IF NOT EXISTS "oyd_flags_tenant_id_idx" ON "oyd_flags"("tenant_id");

ALTER TABLE "oyd_flags"
    ADD CONSTRAINT "oyd_flags_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "oyd_flags"
    ADD CONSTRAINT "oyd_flags_raised_by_id_fkey"
    FOREIGN KEY ("raised_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "oyd_flags"
    ADD CONSTRAINT "oyd_flags_reviewed_by_id_fkey"
    FOREIGN KEY ("reviewed_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "oyd_flags"
    ADD CONSTRAINT "oyd_flags_removed_by_id_fkey"
    FOREIGN KEY ("removed_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
