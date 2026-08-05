-- Requirements: a dependency a team has on someone outside it (documents,
-- credentials, access, copy, a sign-off) with a status somebody has to chase.

CREATE TYPE "RequirementType" AS ENUM ('DOCUMENT', 'CREDENTIAL', 'ACCESS', 'CONTENT', 'DESIGN', 'APPROVAL', 'PAYMENT', 'OTHER');
CREATE TYPE "RequirementStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'PROVIDED', 'REJECTED', 'CLOSED');

CREATE TABLE "project_requirements" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "team_id" TEXT,
    "raised_by_id" TEXT NOT NULL,
    "requested_from_id" TEXT NOT NULL,
    "type" "RequirementType" NOT NULL DEFAULT 'OTHER',
    "status" "RequirementStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "details" TEXT,
    "needed_by" DATE,
    "resolved_at" TIMESTAMP(3),
    "resolution_note" TEXT,
    "reminded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_requirements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "project_requirements_project_id_status_idx" ON "project_requirements"("project_id", "status");
CREATE INDEX "project_requirements_requested_from_id_status_idx" ON "project_requirements"("requested_from_id", "status");
CREATE INDEX "project_requirements_raised_by_id_idx" ON "project_requirements"("raised_by_id");

ALTER TABLE "project_requirements" ADD CONSTRAINT "project_requirements_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_requirements" ADD CONSTRAINT "project_requirements_team_id_fkey"
  FOREIGN KEY ("team_id") REFERENCES "project_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "project_requirements" ADD CONSTRAINT "project_requirements_raised_by_id_fkey"
  FOREIGN KEY ("raised_by_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_requirements" ADD CONSTRAINT "project_requirements_requested_from_id_fkey"
  FOREIGN KEY ("requested_from_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tasks waiting on a requirement. SET NULL so resolving/removing a requirement
-- unblocks its tasks rather than deleting work.
ALTER TABLE "project_tasks" ADD COLUMN "requirement_id" TEXT;
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_requirement_id_fkey"
  FOREIGN KEY ("requirement_id") REFERENCES "project_requirements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
