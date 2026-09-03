-- Clients: the company a project is delivered for.
--
-- Hand-written rather than generated: `prisma migrate dev` cannot run against
-- this database (P3014 - it may not create the shadow database), so the SQL is
-- authored here and applied with `migrate deploy`.
--
-- ADDITIVE ONLY. Both new columns are nullable, so a running build that predates
-- this migration keeps reading and writing projects and portal logins unchanged.

CREATE TYPE "ClientStatus" AS ENUM ('PROSPECT', 'ACTIVE', 'INACTIVE');

CREATE TABLE "clients" (
    -- Same DB-level default as every other tenant-scoped table.
    "tenant_id"     TEXT NOT NULL DEFAULT '0197d1ab-0000-7000-8000-000000000001',
    "id"            TEXT NOT NULL,
    "name"          TEXT NOT NULL,
    "code"          TEXT NOT NULL,
    "slug"          TEXT,
    "status"        "ClientStatus" NOT NULL DEFAULT 'ACTIVE',
    "industry"      TEXT,
    "website"       TEXT,
    "email"         TEXT,
    "phone"         TEXT,
    "address"       TEXT,
    "tax_id"        TEXT,
    "notes"         TEXT,
    "owner_id"      TEXT,
    "created_by_id" TEXT,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "clients_tenant_id_code_key" ON "clients"("tenant_id", "code");
CREATE UNIQUE INDEX "clients_tenant_id_slug_key" ON "clients"("tenant_id", "slug");
CREATE INDEX "clients_status_idx"    ON "clients"("status");
CREATE INDEX "clients_owner_id_idx"  ON "clients"("owner_id");
CREATE INDEX "clients_tenant_id_idx" ON "clients"("tenant_id");

ALTER TABLE "clients"
    ADD CONSTRAINT "clients_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- SetNull: a client outlives whoever managed it or wrote it down.
ALTER TABLE "clients"
    ADD CONSTRAINT "clients_owner_id_fkey"
    FOREIGN KEY ("owner_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "clients"
    ADD CONSTRAINT "clients_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A project belongs to a client. SetNull: deleting a client (only allowed once it
-- has no projects) can never take project history with it.
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "client_id" TEXT;
CREATE INDEX IF NOT EXISTS "projects_client_id_idx" ON "projects"("client_id");
ALTER TABLE "projects"
    ADD CONSTRAINT "projects_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A portal login belongs to a client's company.
ALTER TABLE "client_users" ADD COLUMN IF NOT EXISTS "client_id" TEXT;
CREATE INDEX IF NOT EXISTS "client_users_client_id_idx" ON "client_users"("client_id");
ALTER TABLE "client_users"
    ADD CONSTRAINT "client_users_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Backfill ─────────────────────────────────────────────────────────────────
-- One client per distinct company name typed on a portal login, per tenant.
-- Logins with no company stay unlinked; they are assigned by hand from the
-- Clients screen, which is more honest than inventing a company from a name.
WITH companies AS (
    SELECT
        "tenant_id",
        "company" AS "name",
        trim(both '-' from regexp_replace(lower("company"), '[^a-z0-9]+', '-', 'g')) AS "base",
        row_number() OVER (PARTITION BY "tenant_id" ORDER BY "company") AS "rn"
    FROM "client_users"
    WHERE "company" IS NOT NULL AND btrim("company") <> ''
    GROUP BY "tenant_id", "company"
),
slugged AS (
    SELECT *,
        CASE
            WHEN "base" = '' THEN NULL
            WHEN count(*) OVER (PARTITION BY "tenant_id", "base") > 1 THEN "base" || '-' || "rn"
            ELSE "base"
        END AS "slug"
    FROM companies
)
INSERT INTO "clients" ("tenant_id", "id", "name", "code", "slug", "status", "created_at", "updated_at")
SELECT
    "tenant_id",
    gen_random_uuid()::text,
    "name",
    'CL' || lpad("rn"::text, 5, '0'),
    "slug",
    'ACTIVE',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM slugged;

-- Link each login to the client made from its company name.
UPDATE "client_users" u
SET "client_id" = c."id"
FROM "clients" c
WHERE u."client_id" IS NULL
  AND u."company" IS NOT NULL
  AND c."tenant_id" = u."tenant_id"
  AND c."name" = u."company";

-- A project inherits the client of its earliest-granted portal login. Projects
-- with no linked login stay internal until someone assigns them.
UPDATE "projects" p
SET "client_id" = x."client_id"
FROM (
    SELECT DISTINCT ON (a."project_id") a."project_id", u."client_id"
    FROM "client_project_access" a
    JOIN "client_users" u ON u."id" = a."client_user_id"
    WHERE u."client_id" IS NOT NULL
    ORDER BY a."project_id", a."created_at" ASC
) x
WHERE p."id" = x."project_id" AND p."client_id" IS NULL;
