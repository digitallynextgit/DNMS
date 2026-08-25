-- =============================================================================
-- M4: a per-tenant secret for the attendance push hook.
--
-- Before this there was one ATTENDANCE_HOOK_SECRET for the whole platform, so
-- any customer's door reader could post punches that landed in any other
-- customer's attendance. Attendance is what payroll is computed from, so that
-- is the most consequential shared secret in the system.
--
-- ADDITIVE and NULLABLE. A tenant with no value here has no push configured;
-- Digitally Next additionally falls back to the environment variable, so the
-- terminal already installed in the office keeps working untouched until a
-- secret is generated for it from the admin panel.
-- =============================================================================

ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "hook_secret" TEXT;

-- Unique so the hook can resolve WHICH tenant a request belongs to purely from
-- the secret it presents - and so two tenants can never be issued the same one.
CREATE UNIQUE INDEX IF NOT EXISTS "tenants_hook_secret_key" ON "tenants" ("hook_secret");
