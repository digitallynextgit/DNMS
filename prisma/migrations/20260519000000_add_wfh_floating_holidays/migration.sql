-- ─── Designations: add level taxonomy (L1-L13) + salary caps ─────────────────
ALTER TABLE "designations" ADD COLUMN IF NOT EXISTS "code" TEXT;
ALTER TABLE "designations" ADD COLUMN IF NOT EXISTS "phase" TEXT;
ALTER TABLE "designations" ADD COLUMN IF NOT EXISTS "max_monthly_salary" DOUBLE PRECISION;

CREATE UNIQUE INDEX IF NOT EXISTS "designations_code_key" ON "designations"("code");

-- ─── Work From Home requests ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "wfh_requests" (
    "id"                    TEXT NOT NULL,
    "employee_id"           TEXT NOT NULL,
    "date"                  DATE NOT NULL,
    "reason"                TEXT,
    "status"                "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "is_emergency"          BOOLEAN NOT NULL DEFAULT false,
    "manager_approver_id"   TEXT,
    "manager_approved_at"   TIMESTAMP(3),
    "hr_approver_id"        TEXT,
    "hr_approved_at"        TIMESTAMP(3),
    "rejection_reason"      TEXT,
    "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"            TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wfh_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "wfh_requests_employee_id_idx" ON "wfh_requests"("employee_id");
CREATE INDEX IF NOT EXISTS "wfh_requests_status_idx"      ON "wfh_requests"("status");
CREATE INDEX IF NOT EXISTS "wfh_requests_date_idx"        ON "wfh_requests"("date");

ALTER TABLE "wfh_requests"
  ADD CONSTRAINT "wfh_requests_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wfh_requests"
  ADD CONSTRAINT "wfh_requests_manager_approver_id_fkey"
  FOREIGN KEY ("manager_approver_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wfh_requests"
  ADD CONSTRAINT "wfh_requests_hr_approver_id_fkey"
  FOREIGN KEY ("hr_approver_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Floating Holiday selections (employees pick any 3 of 12 per year) ────────
CREATE TABLE IF NOT EXISTS "floating_holiday_selections" (
    "id"          TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "holiday_id"  TEXT NOT NULL,
    "year"        INTEGER NOT NULL,
    "status"      "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "floating_holiday_selections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "floating_holiday_selections_employee_id_holiday_id_year_key"
  ON "floating_holiday_selections"("employee_id", "holiday_id", "year");

CREATE INDEX IF NOT EXISTS "floating_holiday_selections_employee_id_year_idx"
  ON "floating_holiday_selections"("employee_id", "year");

ALTER TABLE "floating_holiday_selections"
  ADD CONSTRAINT "floating_holiday_selections_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "floating_holiday_selections"
  ADD CONSTRAINT "floating_holiday_selections_holiday_id_fkey"
  FOREIGN KEY ("holiday_id") REFERENCES "holidays"("id") ON DELETE CASCADE ON UPDATE CASCADE;
