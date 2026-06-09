-- Employee-submitted attendance corrections (missed/wrong punch), reviewed by HR/manager.
CREATE TABLE IF NOT EXISTS "attendance_regularizations" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "requested_check_in" TIMESTAMP(3),
    "requested_check_out" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "reviewer_id" TEXT,
    "review_note" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "attendance_regularizations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "attendance_regularizations_employee_id_idx" ON "attendance_regularizations"("employee_id");
CREATE INDEX IF NOT EXISTS "attendance_regularizations_status_idx" ON "attendance_regularizations"("status");

ALTER TABLE "attendance_regularizations"
  ADD CONSTRAINT "attendance_regularizations_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "attendance_regularizations"
  ADD CONSTRAINT "attendance_regularizations_reviewer_id_fkey"
  FOREIGN KEY ("reviewer_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
