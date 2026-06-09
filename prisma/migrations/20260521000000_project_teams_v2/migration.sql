-- ─── Project Management V2 - Teams, Members, Resources, Task approvals ──────

-- New enums
DO $$ BEGIN
  CREATE TYPE "ResourceCategory" AS ENUM ('BRIEFS', 'ASSETS', 'DELIVERABLES', 'REFERENCES', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "TaskApprovalStatus" AS ENUM ('APPROVED', 'PENDING_APPROVAL', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ─── ProjectTeam ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "project_teams" (
    "id"          TEXT NOT NULL,
    "project_id"  TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "manager_id"  TEXT,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL,
    CONSTRAINT "project_teams_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_teams_project_id_name_key" ON "project_teams"("project_id", "name");
CREATE INDEX IF NOT EXISTS "project_teams_project_id_idx" ON "project_teams"("project_id");

ALTER TABLE "project_teams"
  ADD CONSTRAINT "project_teams_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_teams"
  ADD CONSTRAINT "project_teams_manager_id_fkey"
  FOREIGN KEY ("manager_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── ProjectTeamMember ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "project_team_members" (
    "id"          TEXT NOT NULL,
    "team_id"     TEXT NOT NULL,
    "project_id"  TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "joined_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_team_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_team_members_team_id_employee_id_key"     ON "project_team_members"("team_id", "employee_id");
CREATE UNIQUE INDEX IF NOT EXISTS "project_team_members_project_id_employee_id_key"  ON "project_team_members"("project_id", "employee_id");
CREATE INDEX        IF NOT EXISTS "project_team_members_team_id_idx"                 ON "project_team_members"("team_id");
CREATE INDEX        IF NOT EXISTS "project_team_members_employee_id_idx"             ON "project_team_members"("employee_id");

ALTER TABLE "project_team_members"
  ADD CONSTRAINT "project_team_members_team_id_fkey"
  FOREIGN KEY ("team_id") REFERENCES "project_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_team_members"
  ADD CONSTRAINT "project_team_members_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── ProjectResource ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "project_resources" (
    "id"             TEXT NOT NULL,
    "project_id"     TEXT NOT NULL,
    "team_id"        TEXT,
    "category"       "ResourceCategory" NOT NULL DEFAULT 'OTHER',
    "file_name"      TEXT NOT NULL,
    "file_size"      INTEGER NOT NULL,
    "mime_type"      TEXT NOT NULL,
    "object_key"     TEXT NOT NULL,
    "description"    TEXT,
    "uploaded_by_id" TEXT NOT NULL,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_resources_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_resources_object_key_key" ON "project_resources"("object_key");
CREATE INDEX        IF NOT EXISTS "project_resources_project_id_idx" ON "project_resources"("project_id");
CREATE INDEX        IF NOT EXISTS "project_resources_team_id_idx"    ON "project_resources"("team_id");
CREATE INDEX        IF NOT EXISTS "project_resources_category_idx"   ON "project_resources"("category");

ALTER TABLE "project_resources"
  ADD CONSTRAINT "project_resources_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_resources"
  ADD CONSTRAINT "project_resources_team_id_fkey"
  FOREIGN KEY ("team_id") REFERENCES "project_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "project_resources"
  ADD CONSTRAINT "project_resources_uploaded_by_id_fkey"
  FOREIGN KEY ("uploaded_by_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── ProjectTask additions ────────────────────────────────────────────────────
ALTER TABLE "project_tasks" ADD COLUMN IF NOT EXISTS "team_id"             TEXT;
ALTER TABLE "project_tasks" ADD COLUMN IF NOT EXISTS "approval_status"     "TaskApprovalStatus" NOT NULL DEFAULT 'APPROVED';
ALTER TABLE "project_tasks" ADD COLUMN IF NOT EXISTS "is_manager_created"  BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "project_tasks" ADD COLUMN IF NOT EXISTS "rejection_reason"    TEXT;

CREATE INDEX IF NOT EXISTS "project_tasks_team_id_idx"         ON "project_tasks"("team_id");
CREATE INDEX IF NOT EXISTS "project_tasks_approval_status_idx" ON "project_tasks"("approval_status");

ALTER TABLE "project_tasks"
  ADD CONSTRAINT "project_tasks_team_id_fkey"
  FOREIGN KEY ("team_id") REFERENCES "project_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
