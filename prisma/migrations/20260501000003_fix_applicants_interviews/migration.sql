-- Add missing columns to applicants
ALTER TABLE "applicants" ADD COLUMN IF NOT EXISTS "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "applicants" ADD COLUMN IF NOT EXISTS "rejection_reason" TEXT;

-- Make interviewer_id nullable in interviews (schema has it as optional)
ALTER TABLE "interviews" ALTER COLUMN "interviewer_id" DROP NOT NULL;
