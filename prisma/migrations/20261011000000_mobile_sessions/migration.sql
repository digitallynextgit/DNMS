-- =============================================================================
-- Mobile app (iOS / Android): opaque session tokens plus the device rows OAuth
-- cannot hold. Three new tables, NO change to any existing one - so the live
-- build keeps working before the new code is deployed.
--
-- Shaped on purpose like 20261002000000_ai_connector's oauth_grants /
-- oauth_tokens: a connection row, and tokens stored only as SHA-256.
-- mobile_sessions is the connection, mobile_tokens are its access/refresh pair,
-- device_tokens are FCM/APNs registrations for push.
--
-- tenant_id is NOT NULL on all three and carries NO default. Two reasons:
--   1. deprovisionTenant() deletes every tenant_id-bearing model it discovers
--      at runtime, so these tables are cleaned up with the company for free.
--   2. The tenant_spine DEFAULT on the older tables silently lands a row in the
--      founding tenant when a writer forgets the column. Without a default the
--      same mistake is a loud NOT NULL violation instead.
-- Consequence, and it is deliberate: every read of these tables that finds a row
-- BY TOKEN must declare runUnscoped() (the token decides the company, so there
-- is no tenant yet), and every write must name tenant_id itself. See the banner
-- in server/mobile-auth.ts.
--
-- Uniqueness follows 20260826140000_per_tenant_uniques: mobile_tokens.token_hash
-- and device_tokens.token are "globally unique by construction" - a SHA-256 and
-- a vendor-issued device token - so those indexes stay GLOBAL, exactly like
-- push_subscriptions(endpoint). Making them per-tenant would be decorative and
-- would break re-pointing a device token across companies (one handset can hold
-- two companies' employees).
--
-- Hand-written; apply with `npx prisma migrate deploy`. Index and constraint
-- names match what Prisma generates, so `prisma migrate diff` sees no drift.
-- Re-runnable: IF NOT EXISTS throughout, foreign keys declared inline because
-- Postgres has no ADD CONSTRAINT IF NOT EXISTS.
-- =============================================================================

-- CreateTable
CREATE TABLE IF NOT EXISTS "mobile_sessions" (
    "tenant_id" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "device_name" TEXT,
    "app_version" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "revoked_reason" TEXT,

    CONSTRAINT "mobile_sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "mobile_sessions_employee_id_fkey" FOREIGN KEY ("employee_id")
        REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "mobile_sessions_membership_id_fkey" FOREIGN KEY ("membership_id")
        REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "mobile_tokens" (
    "tenant_id" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mobile_tokens_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "mobile_tokens_session_id_fkey" FOREIGN KEY ("session_id")
        REFERENCES "mobile_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "device_tokens" (
    "tenant_id" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "app_version" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3),
    "disabled_at" TIMESTAMP(3),

    CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "device_tokens_employee_id_fkey" FOREIGN KEY ("employee_id")
        REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "mobile_sessions_tenant_id_employee_id_idx"
    ON "mobile_sessions" ("tenant_id", "employee_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "mobile_sessions_membership_id_idx"
    ON "mobile_sessions" ("membership_id");

-- CreateIndex
-- issueSession() retires the previous live session for the same install through this.
CREATE INDEX IF NOT EXISTS "mobile_sessions_membership_id_device_id_idx"
    ON "mobile_sessions" ("membership_id", "device_id");

-- CreateIndex
-- revokeAllForUser() sweeps every device of one person, in every company.
CREATE INDEX IF NOT EXISTS "mobile_sessions_user_id_idx"
    ON "mobile_sessions" ("user_id");

-- CreateIndex
-- The hot path: one lookup by hash per mobile request IS the revocation check.
CREATE UNIQUE INDEX IF NOT EXISTS "mobile_tokens_token_hash_key"
    ON "mobile_tokens" ("token_hash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "mobile_tokens_session_id_idx"
    ON "mobile_tokens" ("session_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "mobile_tokens_tenant_id_idx"
    ON "mobile_tokens" ("tenant_id");

-- CreateIndex
-- Global, not per-tenant: re-pointing a device token at a new signer crosses tenants.
CREATE UNIQUE INDEX IF NOT EXISTS "device_tokens_token_key"
    ON "device_tokens" ("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "device_tokens_employee_id_idx"
    ON "device_tokens" ("employee_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "device_tokens_tenant_id_employee_id_idx"
    ON "device_tokens" ("tenant_id", "employee_id");
