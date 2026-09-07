-- Deliverables get a LIFECYCLE: a row can now be PLANNED before it exists,
-- DELIVERED when it does, and ACCEPTED or REJECTED by the client - recorded by
-- staff, since the client never logs in. Every change is written to an
-- append-only events table, the same shape as project_goal_events.
--
-- Hand-written (migrate dev cannot create a shadow DB here - P3014), additive
-- only, and safe to apply while the previous build is serving: every new
-- column is nullable or defaulted, status defaults to DELIVERED (every existing
-- row was logged after the fact, which is what DELIVERED means), and
-- completed_on only LOOSENS - the old code never writes a row without it.
--
-- goal_id: which promise this output serves when the task link is not enough
-- (or there is no task). SET NULL - removing a goal must not remove the work.

CREATE TYPE "DeliverableStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'DELIVERED', 'ACCEPTED', 'REJECTED');
CREATE TYPE "DeliverableEventType" AS ENUM ('CREATED', 'EDITED', 'STATUS_CHANGED', 'VERIFIED', 'UNVERIFIED', 'LOCKED_EDIT');

ALTER TABLE "project_deliverables"
    ADD COLUMN IF NOT EXISTS "status"          "DeliverableStatus" NOT NULL DEFAULT 'DELIVERED',
    ADD COLUMN IF NOT EXISTS "due_on"          DATE,
    ADD COLUMN IF NOT EXISTS "goal_id"         TEXT,
    ADD COLUMN IF NOT EXISTS "revision_count"  INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "accepted_at"     TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "accepted_by_id"  TEXT,
    ADD COLUMN IF NOT EXISTS "acceptance_note" TEXT;

ALTER TABLE "project_deliverables" ALTER COLUMN "completed_on" DROP NOT NULL;

-- A made thing has a date; a planned one has not. Prisma cannot express this,
-- and every count in the app assumes it, so the database holds the line.
ALTER TABLE "project_deliverables"
    ADD CONSTRAINT "project_deliverables_completed_on_by_status"
    CHECK ("status" IN ('PLANNED', 'IN_PROGRESS') OR "completed_on" IS NOT NULL);

-- "What is planned / awaiting revision on this project" and the goal tally
-- both filter on status inside a project.
CREATE INDEX IF NOT EXISTS "project_deliverables_project_id_status_idx" ON "project_deliverables"("project_id", "status");
CREATE INDEX IF NOT EXISTS "project_deliverables_goal_id_idx"           ON "project_deliverables"("goal_id");

ALTER TABLE "project_deliverables"
    ADD CONSTRAINT "project_deliverables_goal_id_fkey"
    FOREIGN KEY ("goal_id") REFERENCES "project_goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "project_deliverables"
    ADD CONSTRAINT "project_deliverables_accepted_by_id_fkey"
    FOREIGN KEY ("accepted_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The trail. Deleted WITH the deliverable (CASCADE) for the same reason goal
-- events are: history for a row nobody can see is a liability, not an audit.
CREATE TABLE "project_deliverable_events" (
    "tenant_id"      TEXT NOT NULL DEFAULT '0197d1ab-0000-7000-8000-000000000001',
    "id"             TEXT NOT NULL,
    "deliverable_id" TEXT NOT NULL,
    "type"           "DeliverableEventType" NOT NULL,
    "from_status"    "DeliverableStatus",
    "to_status"      "DeliverableStatus",
    -- { field: [before, after] } for EDITED / LOCKED_EDIT / STATUS_CHANGED.
    "changes"        JSONB,
    "reason"         TEXT,
    "actor_id"       TEXT,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_deliverable_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "project_deliverable_events_deliverable_id_created_at_idx" ON "project_deliverable_events"("deliverable_id", "created_at");
CREATE INDEX "project_deliverable_events_tenant_id_idx"                 ON "project_deliverable_events"("tenant_id");

ALTER TABLE "project_deliverable_events"
    ADD CONSTRAINT "project_deliverable_events_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_deliverable_events"
    ADD CONSTRAINT "project_deliverable_events_deliverable_id_fkey"
    FOREIGN KEY ("deliverable_id") REFERENCES "project_deliverables"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_deliverable_events"
    ADD CONSTRAINT "project_deliverable_events_actor_id_fkey"
    FOREIGN KEY ("actor_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- "Done, and there was nothing to log" - answered once, so the capture prompt
-- stops asking. Cleared when a deliverable is later logged against the task.
ALTER TABLE "project_tasks"
    ADD COLUMN IF NOT EXISTS "output_skipped_at" TIMESTAMP(3);
