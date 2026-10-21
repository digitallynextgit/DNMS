-- The SEO team is now ORGANIC PROMOTION and the PERFORMANCE team PAID PROMOTION, on every project.
-- Hand-written; apply with `npx prisma migrate deploy`.

UPDATE "project_teams" t SET "name" = 'ORGANIC PROMOTION', "updated_at" = now()
WHERE t."name" = 'SEO'
  AND NOT EXISTS (SELECT 1 FROM "project_teams" x WHERE x."project_id" = t."project_id" AND x."name" = 'ORGANIC PROMOTION');

UPDATE "project_teams" t SET "name" = 'PAID PROMOTION', "updated_at" = now()
WHERE t."name" = 'PERFORMANCE'
  AND NOT EXISTS (SELECT 1 FROM "project_teams" x WHERE x."project_id" = t."project_id" AND x."name" = 'PAID PROMOTION');
