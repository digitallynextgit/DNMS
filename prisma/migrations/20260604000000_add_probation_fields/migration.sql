-- Probation fields on employees.
-- Effective probation = on_probation AND today < (date_of_joining + probation_months).
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "on_probation" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "probation_months" INTEGER NOT NULL DEFAULT 6;
