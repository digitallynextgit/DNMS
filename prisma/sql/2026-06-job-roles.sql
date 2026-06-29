-- =============================================================================
-- Job roles: a specific role within a department (e.g. Web Development ->
-- "Full Stack Developer"), distinct from Designation (grade) and Department.
-- Idempotent; apply against the live DB.
-- =============================================================================

ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "job_role_id" TEXT;

CREATE TABLE IF NOT EXISTS "job_roles" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "department_id" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "job_roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "job_roles_department_id_name_key"
  ON "job_roles" ("department_id", "name");
CREATE INDEX IF NOT EXISTS "job_roles_department_id_idx"
  ON "job_roles" ("department_id");
CREATE INDEX IF NOT EXISTS "employees_job_role_id_idx"
  ON "employees" ("job_role_id");

DO $$ BEGIN
  ALTER TABLE "job_roles" ADD CONSTRAINT "job_roles_department_id_fkey"
    FOREIGN KEY ("department_id") REFERENCES "departments" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "employees" ADD CONSTRAINT "employees_job_role_id_fkey"
    FOREIGN KEY ("job_role_id") REFERENCES "job_roles" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
