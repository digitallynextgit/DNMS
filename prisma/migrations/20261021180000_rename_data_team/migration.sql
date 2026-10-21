-- The DATA team is now DATA ANALYTICS, on every project. Hand-written; apply with
-- `npx prisma migrate deploy`.

UPDATE "project_teams" t SET "name" = 'DATA ANALYTICS', "updated_at" = now()
WHERE t."name" = 'DATA'
  AND NOT EXISTS (SELECT 1 FROM "project_teams" x WHERE x."project_id" = t."project_id" AND x."name" = 'DATA ANALYTICS');
