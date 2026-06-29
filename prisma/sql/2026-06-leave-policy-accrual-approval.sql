-- =============================================================================
-- Leave overhaul: entitlement policy by employment type, monthly accrual,
-- and routed (manager -> HR -> admin) approvals.
--
-- Idempotent: safe to re-run. Apply against the live DB only (this DB has no
-- shadow-DB perms, so `prisma migrate dev` is not used here).
-- =============================================================================

-- 1. Enums ---------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "AccrualMethod" AS ENUM ('MONTHLY', 'UPFRONT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "LeaveApprovalStage" AS ENUM ('MANAGER', 'HR', 'ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. leave_types.accrual_method ------------------------------------------------
ALTER TABLE "leave_types"
  ADD COLUMN IF NOT EXISTS "accrual_method" "AccrualMethod" NOT NULL DEFAULT 'MONTHLY';

-- 3. leave_balances.accrued ----------------------------------------------------
ALTER TABLE "leave_balances"
  ADD COLUMN IF NOT EXISTS "accrued" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- 4. leave_requests routing columns --------------------------------------------
ALTER TABLE "leave_requests"
  ADD COLUMN IF NOT EXISTS "approval_stage" "LeaveApprovalStage",
  ADD COLUMN IF NOT EXISTS "current_approver_id" TEXT;

-- 5. leave_policies (entitlement matrix) ---------------------------------------
CREATE TABLE IF NOT EXISTS "leave_policies" (
  "id" TEXT NOT NULL,
  "employment_type" "EmploymentType" NOT NULL,
  "leave_type_id" TEXT NOT NULL,
  "days_per_year" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "leave_policies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "leave_policies_employment_type_leave_type_id_key"
  ON "leave_policies" ("employment_type", "leave_type_id");

CREATE INDEX IF NOT EXISTS "leave_requests_current_approver_id_idx"
  ON "leave_requests" ("current_approver_id");

CREATE INDEX IF NOT EXISTS "leave_requests_approval_stage_status_idx"
  ON "leave_requests" ("approval_stage", "status");

-- 6. Foreign keys (guarded) ----------------------------------------------------
DO $$ BEGIN
  ALTER TABLE "leave_policies"
    ADD CONSTRAINT "leave_policies_leave_type_id_fkey"
    FOREIGN KEY ("leave_type_id") REFERENCES "leave_types" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "leave_requests"
    ADD CONSTRAINT "leave_requests_current_approver_id_fkey"
    FOREIGN KEY ("current_approver_id") REFERENCES "employees" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 7. Backfill ------------------------------------------------------------------
-- Availability switches from `allocated` to `accrued`. Make existing balances'
-- already-allocated days fully available so current employees don't drop to 0.
UPDATE "leave_balances" SET "accrued" = "allocated" WHERE "accrued" = 0 AND "allocated" > 0;
