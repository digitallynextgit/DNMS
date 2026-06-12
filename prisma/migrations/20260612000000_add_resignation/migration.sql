-- Self-service resignation requests. An employee applies; their direct manager
-- (or HR) approves. On approval the employee is marked RESIGNED and deactivated
-- (employees.is_active = false), which blocks any further login.
CREATE TABLE IF NOT EXISTS "resignations" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "reason" TEXT,
    "requested_last_working_date" DATE,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "reviewer_id" TEXT,
    "review_note" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "resignations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "resignations_employee_id_idx" ON "resignations"("employee_id");
CREATE INDEX IF NOT EXISTS "resignations_status_idx" ON "resignations"("status");

ALTER TABLE "resignations"
  ADD CONSTRAINT "resignations_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "resignations"
  ADD CONSTRAINT "resignations_reviewer_id_fkey"
  FOREIGN KEY ("reviewer_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
