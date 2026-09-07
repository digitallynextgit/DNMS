-- Goal TARGETS: "50 reels by March" as a row, so a goal's progress can be read
-- off what was actually delivered instead of off task checkboxes.
--
-- Hand-written (migrate dev cannot create a shadow DB here - P3014), additive
-- only: one new table. deliverable_type is free text matched case-insensitively
-- against project_deliverables.type, like every other count in the app.

CREATE TABLE "project_goal_targets" (
    "tenant_id"        TEXT NOT NULL DEFAULT '0197d1ab-0000-7000-8000-000000000001',
    "id"               TEXT NOT NULL,
    "goal_id"          TEXT NOT NULL,
    "deliverable_type" TEXT NOT NULL,
    "quantity"         INTEGER NOT NULL,
    -- Both null = counts everything ever attributed to the goal.
    "period_start"     DATE,
    "period_end"       DATE,
    "created_by_id"    TEXT,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_goal_targets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "project_goal_targets_quantity_positive" CHECK ("quantity" > 0),
    CONSTRAINT "project_goal_targets_period_order"
        CHECK ("period_start" IS NULL OR "period_end" IS NULL OR "period_start" <= "period_end")
);

CREATE INDEX "project_goal_targets_goal_id_idx"   ON "project_goal_targets"("goal_id");
CREATE INDEX "project_goal_targets_tenant_id_idx" ON "project_goal_targets"("tenant_id");

ALTER TABLE "project_goal_targets"
    ADD CONSTRAINT "project_goal_targets_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_goal_targets"
    ADD CONSTRAINT "project_goal_targets_goal_id_fkey"
    FOREIGN KEY ("goal_id") REFERENCES "project_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_goal_targets"
    ADD CONSTRAINT "project_goal_targets_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
