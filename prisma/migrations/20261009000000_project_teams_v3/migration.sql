-- Project teams v3: the 11-team catalogue (features/projects/lib/project-teams.ts), and a person may
-- now be on several teams of one project (still once per team). Hand-written and idempotent;
-- apply with `npx prisma migrate deploy`.

-- A person may be on several teams of a project, and on several teams' rows of one calendar.
DROP INDEX IF EXISTS "project_team_members_project_id_employee_id_key";
CREATE INDEX IF NOT EXISTS "project_team_members_project_id_employee_id_idx"
    ON "project_team_members"("project_id", "employee_id");

DROP INDEX IF EXISTS "project_workbook_team_members_workbook_id_employee_id_key";
CREATE INDEX IF NOT EXISTS "project_workbook_team_members_workbook_id_employee_id_idx"
    ON "project_workbook_team_members"("workbook_id", "employee_id");

-- Renames keep each team's id, so its tasks, deliverables and calendar rows stay attached.
UPDATE "project_teams" t SET "name" = 'CONTENT', "updated_at" = now()
WHERE t."name" = 'MAP'
  AND NOT EXISTS (SELECT 1 FROM "project_teams" x WHERE x."project_id" = t."project_id" AND x."name" = 'CONTENT');
UPDATE "project_teams" t SET "name" = 'SMO', "updated_at" = now()
WHERE t."name" = 'AMG/SMO'
  AND NOT EXISTS (SELECT 1 FROM "project_teams" x WHERE x."project_id" = t."project_id" AND x."name" = 'SMO');

-- Every project gets the catalogue teams it is missing.
INSERT INTO "project_teams" ("tenant_id", "id", "project_id", "name", "created_at", "updated_at")
SELECT p."tenant_id", gen_random_uuid()::text, p."id", c."name", now(), now()
FROM "projects" p
CROSS JOIN (VALUES ('AM'), ('WEB'), ('DESIGN'), ('VIDEO'), ('CONTENT'), ('SMO'), ('SEO'),
                   ('PERFORMANCE'), ('PR'), ('ALLIANCES & PARTNERSHIPS'), ('ADMIN')) AS c("name")
WHERE NOT EXISTS (
    SELECT 1 FROM "project_teams" t WHERE t."project_id" = p."id" AND t."name" = c."name"
);

-- The project's Account Manager (its owner) manages the AM team.
UPDATE "project_teams" t
SET "manager_id" = p."owner_id", "updated_at" = now()
FROM "projects" p
WHERE t."project_id" = p."id" AND t."name" = 'AM' AND t."manager_id" IS NULL;

INSERT INTO "project_team_members" ("tenant_id", "id", "team_id", "project_id", "employee_id", "joined_at")
SELECT t."tenant_id", gen_random_uuid()::text, t."id", t."project_id", t."manager_id", now()
FROM "project_teams" t
WHERE t."name" = 'AM' AND t."manager_id" IS NOT NULL
ON CONFLICT ("team_id", "employee_id") DO NOTHING;

-- SMO members from the Alliances & Partnerships department move to that team.
INSERT INTO "project_team_members" ("tenant_id", "id", "team_id", "project_id", "employee_id", "joined_at")
SELECT m."tenant_id", gen_random_uuid()::text, a."id", m."project_id", m."employee_id", now()
FROM "project_team_members" m
JOIN "project_teams" s ON s."id" = m."team_id" AND s."name" = 'SMO'
JOIN "employees" e ON e."id" = m."employee_id"
JOIN "departments" d ON d."id" = e."department_id" AND d."name" = 'Alliances & Partnerships'
JOIN "project_teams" a ON a."project_id" = m."project_id" AND a."name" = 'ALLIANCES & PARTNERSHIPS'
ON CONFLICT ("team_id", "employee_id") DO NOTHING;

DELETE FROM "project_team_members" m
USING "project_teams" s, "employees" e, "departments" d
WHERE s."id" = m."team_id" AND s."name" = 'SMO'
  AND e."id" = m."employee_id"
  AND d."id" = e."department_id" AND d."name" = 'Alliances & Partnerships'
  AND s."manager_id" IS DISTINCT FROM m."employee_id";

-- CONTENT (ex-MAP) members from the PR department are also added to the PR team.
INSERT INTO "project_team_members" ("tenant_id", "id", "team_id", "project_id", "employee_id", "joined_at")
SELECT m."tenant_id", gen_random_uuid()::text, r."id", m."project_id", m."employee_id", now()
FROM "project_team_members" m
JOIN "project_teams" c ON c."id" = m."team_id" AND c."name" = 'CONTENT'
JOIN "employees" e ON e."id" = m."employee_id"
JOIN "departments" d ON d."id" = e."department_id" AND d."name" = 'PR'
JOIN "project_teams" r ON r."project_id" = m."project_id" AND r."name" = 'PR'
ON CONFLICT ("team_id", "employee_id") DO NOTHING;

-- As in the app, the first person on a team without a manager becomes its manager.
UPDATE "project_teams" t
SET "manager_id" = (
        SELECT m."employee_id" FROM "project_team_members" m
        WHERE m."team_id" = t."id" ORDER BY m."joined_at", m."id" LIMIT 1
    ),
    "updated_at" = now()
WHERE t."name" IN ('ALLIANCES & PARTNERSHIPS', 'PR')
  AND t."manager_id" IS NULL
  AND EXISTS (SELECT 1 FROM "project_team_members" m WHERE m."team_id" = t."id");
