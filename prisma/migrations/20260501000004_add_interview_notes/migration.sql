-- Add missing notes column to interviews
ALTER TABLE "interviews" ADD COLUMN IF NOT EXISTS "notes" TEXT;
