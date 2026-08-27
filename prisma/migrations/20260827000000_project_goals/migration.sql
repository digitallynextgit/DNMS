-- Project goals: a main goal, its sub-goals, a target date and progress.
--
-- Hand-written rather than generated: `prisma migrate dev` cannot run against
-- this database (P3014 - it may not create the shadow database), so the SQL is
-- authored here and applied with `migrate deploy`. See docs and the earlier
-- tenancy migrations for the same pattern.
--
-- ADDITIVE ONLY. Nothing existing is altered, so a running build that predates
-- this migration keeps working unchanged.

CREATE TYPE "GoalStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'AT_RISK', 'DONE');

CREATE TABLE "project_goals" (
    -- Same DB-level default as every other tenant-scoped table, so an INSERT
    -- from a build that does not yet know about tenants still lands correctly.
    "tenant_id"     TEXT NOT NULL DEFAULT '0197d1ab-0000-7000-8000-000000000001',
    "id"            TEXT NOT NULL,
    "project_id"    TEXT NOT NULL,
    -- NULL = a main goal. Set = a sub-goal of that main goal.
    "parent_id"     TEXT,
    "title"         TEXT NOT NULL,
    "description"   TEXT,
    "status"        "GoalStatus" NOT NULL DEFAULT 'NOT_STARTED',
    -- 0-100. Authoritative for a leaf; ignored for a goal that has sub-goals,
    -- which reports the average of its children instead.
    "progress"      INTEGER NOT NULL DEFAULT 0,
    "target_date"   DATE,
    "sort_order"    INTEGER NOT NULL DEFAULT 0,
    "created_by_id" TEXT,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_goals_pkey" PRIMARY KEY ("id"),
    -- The stored number can only ever be a percentage. Clamping in the API as
    -- well is belt and braces; this is what makes it true.
    CONSTRAINT "project_goals_progress_range" CHECK ("progress" >= 0 AND "progress" <= 100),
    -- A goal cannot be its own parent. Deeper cycles are prevented by the API,
    -- which allows exactly one level of nesting.
    CONSTRAINT "project_goals_no_self_parent" CHECK ("parent_id" IS NULL OR "parent_id" <> "id")
);

CREATE INDEX "project_goals_project_id_idx"            ON "project_goals"("project_id");
CREATE INDEX "project_goals_parent_id_idx"             ON "project_goals"("parent_id");
CREATE INDEX "project_goals_project_id_sort_order_idx" ON "project_goals"("project_id", "sort_order");
CREATE INDEX "project_goals_tenant_id_idx"             ON "project_goals"("tenant_id");

ALTER TABLE "project_goals"
    ADD CONSTRAINT "project_goals_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "project_goals"
    ADD CONSTRAINT "project_goals_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Deleting a main goal takes its sub-goals with it: a sub-goal has no meaning
-- without the goal it belongs to.
ALTER TABLE "project_goals"
    ADD CONSTRAINT "project_goals_parent_id_fkey"
    FOREIGN KEY ("parent_id") REFERENCES "project_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SetNull: a goal outlives whoever happened to write it down.
ALTER TABLE "project_goals"
    ADD CONSTRAINT "project_goals_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
