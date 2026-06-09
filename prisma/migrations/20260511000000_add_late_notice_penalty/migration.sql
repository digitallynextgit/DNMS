-- Add late_notice_penalty flag to leave_requests
-- Used by payroll to apply double salary deduction when advance notice wasn't given
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "late_notice_penalty" BOOLEAN NOT NULL DEFAULT false;
