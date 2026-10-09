-- A project's short name ("DN", "H2S") and the services it includes. Additive, so the live build
-- keeps working before the new code is deployed. Hand-written; apply with `npx prisma migrate deploy`.
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "short_name" TEXT;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "services" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Unique per company, ignoring case ("DN" and "dn" clash).
CREATE UNIQUE INDEX IF NOT EXISTS "projects_tenant_id_short_name_key"
    ON "projects" ("tenant_id", lower("short_name"))
    WHERE "short_name" IS NOT NULL;
