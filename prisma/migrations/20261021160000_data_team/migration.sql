-- DATA joins the fixed team catalogue (for the Data & Analytics service); every project gets it,
-- with no manager yet. Hand-written; apply with `npx prisma migrate deploy`.

INSERT INTO "project_teams" ("tenant_id", "id", "project_id", "name", "created_at", "updated_at")
SELECT p."tenant_id", gen_random_uuid()::text, p."id", 'DATA', now(), now()
FROM "projects" p
WHERE NOT EXISTS (
    SELECT 1 FROM "project_teams" t WHERE t."project_id" = p."id" AND t."name" = 'DATA'
);
