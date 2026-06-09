-- AlterEnum: Add PENDING value to ReviewStatus
-- Must be in its own migration (cannot use new enum value in same transaction)
ALTER TYPE "ReviewStatus" ADD VALUE IF NOT EXISTS 'PENDING' BEFORE 'DRAFT';
