-- Drop packages; put the module list directly on the grant.
--
-- Packages were an indirection nobody asked for: clients are added from inside a
-- project, and whoever adds them picks that client's sections there and then.
-- Storing the modules ON the grant also removes a sharp edge - editing a shared
-- package silently changed what every client holding it could see.
--
-- Written as a second migration rather than an edit to 20260813000000 so it
-- applies cleanly whether or not that one has already run.

-- 1. New column (nullable for the backfill, tightened afterwards).
ALTER TABLE "client_project_access" ADD COLUMN "modules" TEXT[];

-- 2. Carry over whatever each grant's package granted, so any access created
--    before this migration keeps working unchanged.
UPDATE "client_project_access" a
SET "modules" = p."modules"
FROM "client_packages" p
WHERE a."package_id" = p."id";

-- 3. Anything unmatched gets an empty list - deny by default, never a guess.
UPDATE "client_project_access" SET "modules" = ARRAY[]::TEXT[] WHERE "modules" IS NULL;

ALTER TABLE "client_project_access" ALTER COLUMN "modules" SET NOT NULL;

-- 4. Drop the package link and the table itself.
ALTER TABLE "client_project_access" DROP CONSTRAINT IF EXISTS "client_project_access_package_id_fkey";
ALTER TABLE "client_project_access" DROP COLUMN "package_id";

DROP TABLE IF EXISTS "client_packages";
