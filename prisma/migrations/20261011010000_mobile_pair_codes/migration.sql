-- =============================================================================
-- Phone pairing: the short-lived, single-use code a signed-in browser mints so
-- the app can be signed in without a password. ONE new table, NO change to any
-- existing one - so the live build keeps working before the new code is
-- deployed, and rolling back is `DROP TABLE` and nothing else.
--
-- WHY A TABLE AND NOT AN EXISTING MECHANISM. Two candidates were read first:
--
--   * oauth_authorizations (20261002000000_ai_connector) is the closest shape -
--     a hashed one-time code with expires_at - and the pattern below is lifted
--     from it. It cannot be REUSED: every column that identifies the request is
--     OAuth's (client_id FKs oauth_clients, plus redirect_uri, scope, resource
--     and a NOT NULL PKCE code_challenge), it names no person at all (it points
--     at the grant created on Allow), and its single-use mark is consumed_at
--     rather than a delete. Pairing has no client, no redirect and no PKCE, and
--     it must name the employee it pairs AS. Borrowing the table would mean
--     inventing a fake OAuth client and a fake redirect URI for every code.
--   * mobile_tokens (20261011000000_mobile_sessions) is NOT NULL on session_id,
--     and the whole point of a pairing code is that no session exists yet.
--
--   password_resets was also considered and is the wrong shape for the opposite
--   reason: it is an email-delivered OTP with its own attempt accounting, tied
--   to a flow that ends in a password write.
--
-- SHAPED like oauth_authorizations and mobile_tokens: the code is stored ONLY as
-- SHA-256, and the unique index is on that hash because the hash IS the lookup
-- key. Globally unique rather than per-tenant (20260826140000_per_tenant_uniques
-- is the rule): two live codes with the same six digits would make one of them
-- unredeemable no matter which company they belong to, so the constraint has to
-- see across tenants - exactly like mobile_tokens.token_hash.
--
-- tenant_id is NOT NULL and carries NO default, for the two reasons the mobile
-- session migration gives: deprovisionTenant() deletes every tenant_id-bearing
-- model it discovers at runtime, so these rows are cleaned up with the company
-- for free; and without a tenant_spine DEFAULT a writer who forgets the column
-- gets a loud NOT NULL violation instead of a row quietly filed under the
-- founding tenant. The consequence is the same too: the read that finds a row BY
-- CODE must declare runUnscoped() (the code decides the company, so there is no
-- tenant yet) and the insert names tenant_id itself. See the banner in
-- server/mobile-pairing.ts.
--
-- NO tenant_id INDEX, unlike mobile_tokens, and deliberately: this table holds
-- only codes minted in the last five minutes - every mint sweeps the expired
-- ones - so it is a handful of rows, and the deprovision sweep that would use
-- such an index is a sequential scan of nothing. The two indexes below are the
-- ones real queries take: expires_at for the sweep, membership_id for "replace
-- this person's previous code".
--
-- Hand-written; applied with psql, then recorded in _prisma_migrations with the
-- file's SHA-256 so `prisma migrate deploy` sees it as done rather than pending.
-- Index and constraint names match what Prisma generates, so `prisma migrate
-- diff` sees no drift. Re-runnable: IF NOT EXISTS throughout, foreign keys
-- declared inline because Postgres has no ADD CONSTRAINT IF NOT EXISTS.
-- =============================================================================

-- CreateTable
CREATE TABLE IF NOT EXISTS "mobile_pair_codes" (
    "tenant_id" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mobile_pair_codes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "mobile_pair_codes_employee_id_fkey" FOREIGN KEY ("employee_id")
        REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "mobile_pair_codes_membership_id_fkey" FOREIGN KEY ("membership_id")
        REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
-- The lookup: one read by hash per redemption. Global, not per-tenant - the
-- header says why.
CREATE UNIQUE INDEX IF NOT EXISTS "mobile_pair_codes_code_hash_key"
    ON "mobile_pair_codes" ("code_hash");

-- CreateIndex
-- The sweep every mint runs, which is the only thing that ever deletes an
-- expired code.
CREATE INDEX IF NOT EXISTS "mobile_pair_codes_expires_at_idx"
    ON "mobile_pair_codes" ("expires_at");

-- CreateIndex
-- "One live code per person": a mint deletes the caller's previous code through
-- this, so reloading the page cannot leave a second guessable code alive.
CREATE INDEX IF NOT EXISTS "mobile_pair_codes_membership_id_idx"
    ON "mobile_pair_codes" ("membership_id");
