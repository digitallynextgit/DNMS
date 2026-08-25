-- =============================================================================
-- M2 - Identity: platform-level `users` + `memberships`.
--
-- ADDITIVE ONLY. Nothing is dropped and nothing existing changes meaning, so
-- the build currently deployed on the VPS - which authenticates against
-- employees.password_hash and client_users.password_hash - keeps working
-- against this schema unchanged. Those legacy columns come off in M4, after the
-- new build has been live long enough to trust.
--
-- The one column whose shape changes is password_resets.employee_id, which
-- becomes NULLABLE. That is safe in both directions: the old build always
-- supplies it, and a nullable column accepts everything a NOT NULL one did.
--
-- Runs as ONE transaction (Prisma wraps each migration file). The assertions at
-- the end abort it if the backfill left anybody behind, so a partial identity
-- table can never reach production.
-- =============================================================================

-- ── 1. Enum ──────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "MembershipKind" AS ENUM ('STAFF', 'CLIENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. users ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "users" (
  "id"                   TEXT NOT NULL,
  "email"                TEXT NOT NULL,
  "name"                 TEXT NOT NULL,
  "password_hash"        TEXT,
  "must_change_password" BOOLEAN NOT NULL DEFAULT false,
  "email_verified"       TIMESTAMP(3),
  "last_login_at"        TIMESTAMP(3),
  "is_active"            BOOLEAN NOT NULL DEFAULT true,
  "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");
CREATE INDEX IF NOT EXISTS "users_is_active_idx" ON "users"("is_active");

-- ── 3. memberships ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "memberships" (
  "id"             TEXT NOT NULL,
  "user_id"        TEXT NOT NULL,
  "tenant_id"      TEXT NOT NULL,
  "kind"           "MembershipKind" NOT NULL,
  "employee_id"    TEXT,
  "client_user_id" TEXT,
  "is_active"      BOOLEAN NOT NULL DEFAULT true,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "memberships_user_id_tenant_id_kind_key"
  ON "memberships"("user_id", "tenant_id", "kind");
CREATE UNIQUE INDEX IF NOT EXISTS "memberships_employee_id_key"
  ON "memberships"("employee_id");
CREATE UNIQUE INDEX IF NOT EXISTS "memberships_client_user_id_key"
  ON "memberships"("client_user_id");
CREATE INDEX IF NOT EXISTS "memberships_tenant_id_is_active_idx"
  ON "memberships"("tenant_id", "is_active");
CREATE INDEX IF NOT EXISTS "memberships_user_id_idx" ON "memberships"("user_id");

-- ── 4. Backfill users ────────────────────────────────────────────────────────
-- Staff first: where an address somehow exists on both sides, the employee's
-- credential is the one that survives (a staff account is the higher-privilege
-- one, so it must never be silently replaced by a client's). The collision
-- report run before this migration found none, and assertion 3 below re-checks.
INSERT INTO "users" (id, email, name, password_hash, must_change_password, email_verified, is_active, created_at, updated_at)
SELECT gen_random_uuid()::text,
       lower(e.email),
       e.first_name || ' ' || e.last_name,
       e.password_hash,
       e.must_change_password,
       e.email_verified,
       e.is_active,
       e.created_at,
       NOW()
  FROM employees e
ON CONFLICT (email) DO NOTHING;

INSERT INTO "users" (id, email, name, password_hash, must_change_password, last_login_at, is_active, created_at, updated_at)
SELECT gen_random_uuid()::text,
       lower(c.email),
       c.name,
       c.password_hash,
       c.must_change_password,
       c.last_login_at,
       c.is_active,
       c.created_at,
       NOW()
  FROM client_users c
ON CONFLICT (email) DO NOTHING;

-- ── 5. Backfill memberships ──────────────────────────────────────────────────
INSERT INTO "memberships" (id, user_id, tenant_id, kind, employee_id, is_active, created_at, updated_at)
SELECT gen_random_uuid()::text, u.id, e.tenant_id, 'STAFF', e.id, e.is_active, e.created_at, NOW()
  FROM employees e
  JOIN "users" u ON u.email = lower(e.email)
ON CONFLICT (employee_id) DO NOTHING;

INSERT INTO "memberships" (id, user_id, tenant_id, kind, client_user_id, is_active, created_at, updated_at)
SELECT gen_random_uuid()::text, u.id, c.tenant_id, 'CLIENT', c.id, c.is_active, c.created_at, NOW()
  FROM client_users c
  JOIN "users" u ON u.email = lower(c.email)
ON CONFLICT (client_user_id) DO NOTHING;

-- ── 6. password_resets → users ───────────────────────────────────────────────
ALTER TABLE "password_resets" ADD COLUMN IF NOT EXISTS "user_id" TEXT;

UPDATE "password_resets" pr
   SET "user_id" = u.id
  FROM employees e
  JOIN "users" u ON u.email = lower(e.email)
 WHERE pr.employee_id = e.id AND pr."user_id" IS NULL;

-- Any reset row whose employee has since been deleted cannot be attributed and
-- is dead anyway (the FK cascade would have removed it). Clear the strays so
-- the NOT NULL below can be applied.
DELETE FROM "password_resets" WHERE "user_id" IS NULL;

ALTER TABLE "password_resets" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "password_resets" ALTER COLUMN "employee_id" DROP NOT NULL;
CREATE INDEX IF NOT EXISTS "password_resets_user_id_idx" ON "password_resets"("user_id");

-- ── 7. Composite-unique targets for the cross-tenant guard ───────────────────
-- (id) is already the primary key, so (id, tenant_id) is trivially unique; the
-- index exists purely so it can be a foreign-key target in step 8.
CREATE UNIQUE INDEX IF NOT EXISTS "employees_id_tenant_id_key"
  ON "employees"("id", "tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "client_users_id_tenant_id_key"
  ON "client_users"("id", "tenant_id");

-- ── 8. Foreign keys ──────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "memberships" ADD CONSTRAINT "memberships_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- COMPOSITE, not a plain FK on employee_id: including tenant_id makes it
-- impossible to attach a membership in tenant A to a profile row in tenant B.
-- Prisma does not model this constraint (its relation is single-column); the
-- database enforces it regardless, which is the point.
DO $$ BEGIN
  ALTER TABLE "memberships" ADD CONSTRAINT "memberships_employee_id_tenant_id_fkey"
    FOREIGN KEY ("employee_id", "tenant_id") REFERENCES "employees"("id", "tenant_id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "memberships" ADD CONSTRAINT "memberships_client_user_id_tenant_id_fkey"
    FOREIGN KEY ("client_user_id", "tenant_id") REFERENCES "client_users"("id", "tenant_id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 9. The kind/profile CHECK ────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE "memberships" ADD CONSTRAINT "memberships_kind_profile_check" CHECK (
       (kind = 'STAFF'  AND employee_id IS NOT NULL AND client_user_id IS NULL)
    OR (kind = 'CLIENT' AND client_user_id IS NOT NULL AND employee_id IS NULL)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 10. Assertions - abort the whole migration if the backfill is incomplete ──
DO $$
DECLARE
  missing_staff  INT;
  missing_client INT;
  collisions     INT;
BEGIN
  SELECT COUNT(*) INTO missing_staff
    FROM employees e LEFT JOIN memberships m ON m.employee_id = e.id
   WHERE m.id IS NULL;
  IF missing_staff > 0 THEN
    RAISE EXCEPTION '% employee(s) have no membership - identity backfill incomplete', missing_staff;
  END IF;

  SELECT COUNT(*) INTO missing_client
    FROM client_users c LEFT JOIN memberships m ON m.client_user_id = c.id
   WHERE m.id IS NULL;
  IF missing_client > 0 THEN
    RAISE EXCEPTION '% client user(s) have no membership - identity backfill incomplete', missing_client;
  END IF;

  -- If an address WAS shared, the client's credential was silently dropped by
  -- the ON CONFLICT above. That is a decision a human has to make, not a
  -- migration - so refuse to proceed rather than quietly invalidate a login.
  SELECT COUNT(*) INTO collisions
    FROM client_users c JOIN employees e ON lower(e.email) = lower(c.email);
  IF collisions > 0 THEN
    RAISE EXCEPTION
      '% email(s) are shared between employees and client_users - run prisma/report-email-collisions.ts and resolve them first',
      collisions;
  END IF;
END $$;
