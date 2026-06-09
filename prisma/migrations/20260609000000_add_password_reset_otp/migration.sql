-- AlterTable: add OTP support to password reset flow
ALTER TABLE "password_resets" ADD COLUMN "otp_hash" TEXT;
ALTER TABLE "password_resets" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
