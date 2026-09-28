-- Session revocation on credential change (security audit 2026-09-28).
-- setPassword() stamps this; the JWT re-check signs out any token whose authAt
-- predates it. NULL (all existing rows) means "never changed under this regime"
-- and skips the check, so nobody is signed out by the migration itself.
ALTER TABLE "users" ADD COLUMN "password_changed_at" TIMESTAMP(3);
