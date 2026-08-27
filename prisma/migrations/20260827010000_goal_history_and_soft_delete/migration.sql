-- Goals: a DISCARDED state, soft deactivation, and an append-only history.
--
-- Hand-written (migrate dev cannot create a shadow DB here - P3014), additive
-- only, and safe to apply while the previous build is serving.

-- 1. DISCARDED joins the status enum. Postgres allows adding a value in place.
ALTER TYPE "GoalStatus" ADD VALUE IF NOT EXISTS 'DISCARDED';

-- 2. Soft delete + the reason currently attached to the goal.
ALTER TABLE "project_goals"
    ADD COLUMN IF NOT EXISTS "is_active"      BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS "deactivated_at" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "status_reason"  TEXT;

-- Reading the board always filters on this, so it earns its index.
CREATE INDEX IF NOT EXISTS "project_goals_project_id_is_active_idx"
    ON "project_goals"("project_id", "is_active");

-- 3. The history. Append-only: nothing in the app updates or deletes a row here
--    except the cascade when a goal is permanently removed.
CREATE TYPE "GoalEventType" AS ENUM ('CREATED', 'STATUS_CHANGED', 'DEACTIVATED', 'REACTIVATED', 'EDITED');

CREATE TABLE "project_goal_events" (
    "tenant_id"   TEXT NOT NULL DEFAULT '0197d1ab-0000-7000-8000-000000000001',
    "id"          TEXT NOT NULL,
    "goal_id"     TEXT NOT NULL,
    "type"        "GoalEventType" NOT NULL,
    "from_status" "GoalStatus",
    "to_status"   "GoalStatus",
    "reason"      TEXT,
    "actor_id"    TEXT,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_goal_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "project_goal_events_goal_id_created_at_idx"
    ON "project_goal_events"("goal_id", "created_at");
CREATE INDEX "project_goal_events_tenant_id_idx"
    ON "project_goal_events"("tenant_id");

ALTER TABLE "project_goal_events"
    ADD CONSTRAINT "project_goal_events_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Cascade: history for a goal nobody can see is a liability, not an audit
-- trail. Deactivating (the default) keeps the goal AND its history.
ALTER TABLE "project_goal_events"
    ADD CONSTRAINT "project_goal_events_goal_id_fkey"
    FOREIGN KEY ("goal_id") REFERENCES "project_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_goal_events"
    ADD CONSTRAINT "project_goal_events_actor_id_fkey"
    FOREIGN KEY ("actor_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
