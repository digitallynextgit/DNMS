-- Encrypted Gmail App Password (AES-256-GCM, format iv:tag:ct) for sendEmailAs().
-- The column was declared in the Prisma schema but never created in the database;
-- this backfills the missing column. Nullable, never returned in API responses.
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "gmail_app_password" TEXT;
