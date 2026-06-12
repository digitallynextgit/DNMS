-- Force-password-change-on-first-login flag. Defaults false so existing
-- employees are unaffected.
ALTER TABLE "employees" ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT false;
