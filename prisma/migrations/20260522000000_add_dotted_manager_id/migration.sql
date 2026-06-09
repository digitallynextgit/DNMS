-- Add dotted-line manager relationship on employees
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "dotted_manager_id" TEXT;

ALTER TABLE "employees"
  ADD CONSTRAINT "employees_dotted_manager_id_fkey"
  FOREIGN KEY ("dotted_manager_id") REFERENCES "employees"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
