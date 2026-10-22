-- Full & Final settlement register (Exit Clearance > Full & Final). Additive; hand-written, apply
-- with `npx prisma migrate deploy`.

CREATE TABLE IF NOT EXISTS "full_final_settlements" (
    "tenant_id"            TEXT NOT NULL DEFAULT '0197d1ab-0000-7000-8000-000000000001',
    "id"                   TEXT NOT NULL,
    "employee_id"          TEXT,
    "name"                 TEXT NOT NULL,
    "designation"          TEXT,
    "last_working_date"    DATE NOT NULL,
    "due_date"             DATE NOT NULL,
    "released_on"          DATE,
    "notice_period"        TEXT,
    "relieving_given"      BOOLEAN NOT NULL DEFAULT false,
    "relieving_date"       DATE,
    "notes"                TEXT,
    "due_soon_notified_at" TIMESTAMP(3),
    "overdue_notified_at"  TIMESTAMP(3),
    "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"           TIMESTAMP(3) NOT NULL,

    CONSTRAINT "full_final_settlements_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "full_final_settlements_notice_period_check"
        CHECK ("notice_period" IS NULL OR "notice_period" IN ('SERVED', 'NOT_SERVED', 'COMPANY_EXIT'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "full_final_settlements_employee_id_key" ON "full_final_settlements"("employee_id");
CREATE INDEX IF NOT EXISTS "full_final_settlements_tenant_id_idx" ON "full_final_settlements"("tenant_id");
CREATE INDEX IF NOT EXISTS "full_final_settlements_due_date_idx" ON "full_final_settlements"("due_date");

ALTER TABLE "full_final_settlements"
    ADD CONSTRAINT "full_final_settlements_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
