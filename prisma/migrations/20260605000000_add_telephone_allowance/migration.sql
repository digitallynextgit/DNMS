-- Add Telephone/Mobile allowance bracket to salary structures and payroll records.
ALTER TABLE "salary_structures" ADD COLUMN IF NOT EXISTS "telephone_allowance" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "payroll_records" ADD COLUMN IF NOT EXISTS "telephone_allowance" DOUBLE PRECISION NOT NULL DEFAULT 0;
