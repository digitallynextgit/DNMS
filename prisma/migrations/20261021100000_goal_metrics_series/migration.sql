-- Goals with numbers ("3000 orders"), split by service, one-time or repeating monthly, with the
-- actual results entered against them. Additive, so the live build keeps working before the new
-- code is deployed. Hand-written; apply with `npx prisma migrate deploy`.

CREATE TABLE IF NOT EXISTS "project_goal_series" (
    "tenant_id"     TEXT NOT NULL DEFAULT '0197d1ab-0000-7000-8000-000000000001',
    "id"            TEXT NOT NULL,
    "project_id"    TEXT NOT NULL,
    "title"         TEXT NOT NULL,
    "cadence"       TEXT NOT NULL DEFAULT 'MONTHLY',
    "stopped_at"    TIMESTAMP(3),
    "created_by_id" TEXT,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_goal_series_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "project_goal_series_project_id_idx" ON "project_goal_series"("project_id");
CREATE INDEX IF NOT EXISTS "project_goal_series_tenant_id_idx" ON "project_goal_series"("tenant_id");

ALTER TABLE "project_goal_series"
    ADD CONSTRAINT "project_goal_series_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_goal_series"
    ADD CONSTRAINT "project_goal_series_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "project_goals" ADD COLUMN IF NOT EXISTS "metric_label" TEXT;
ALTER TABLE "project_goals" ADD COLUMN IF NOT EXISTS "target_value" DOUBLE PRECISION;
ALTER TABLE "project_goals" ADD COLUMN IF NOT EXISTS "service" TEXT;
ALTER TABLE "project_goals" ADD COLUMN IF NOT EXISTS "actual_source" TEXT NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "project_goals" ADD COLUMN IF NOT EXISTS "series_id" TEXT;
ALTER TABLE "project_goals" ADD COLUMN IF NOT EXISTS "period_start" DATE;
ALTER TABLE "project_goals" ADD COLUMN IF NOT EXISTS "period_end" DATE;

ALTER TABLE "project_goals"
    ADD CONSTRAINT "project_goals_series_id_fkey"
    FOREIGN KEY ("series_id") REFERENCES "project_goal_series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "project_goals_series_id_period_start_idx"
    ON "project_goals"("series_id", "period_start");
-- One main goal per series per month, so two rollovers can't both create the month.
CREATE UNIQUE INDEX IF NOT EXISTS "project_goals_series_month_main_key"
    ON "project_goals"("series_id", "period_start") WHERE parent_id IS NULL;

ALTER TABLE "project_goals"
    ADD CONSTRAINT "project_goals_target_value_check" CHECK ("target_value" IS NULL OR "target_value" > 0);
ALTER TABLE "project_goals"
    ADD CONSTRAINT "project_goals_period_check"
    CHECK (("period_start" IS NULL) = ("period_end" IS NULL) AND ("period_end" IS NULL OR "period_end" >= "period_start"));

CREATE TABLE IF NOT EXISTS "project_goal_results" (
    "tenant_id"     TEXT NOT NULL DEFAULT '0197d1ab-0000-7000-8000-000000000001',
    "id"            TEXT NOT NULL,
    "goal_id"       TEXT NOT NULL,
    "recorded_for"  DATE NOT NULL,
    "value"         DOUBLE PRECISION NOT NULL,
    "note"          TEXT,
    "entered_by_id" TEXT,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_goal_results_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "project_goal_results_goal_id_recorded_for_idx"
    ON "project_goal_results"("goal_id", "recorded_for");
CREATE INDEX IF NOT EXISTS "project_goal_results_tenant_id_idx" ON "project_goal_results"("tenant_id");

ALTER TABLE "project_goal_results"
    ADD CONSTRAINT "project_goal_results_goal_id_fkey"
    FOREIGN KEY ("goal_id") REFERENCES "project_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_goal_results"
    ADD CONSTRAINT "project_goal_results_entered_by_id_fkey"
    FOREIGN KEY ("entered_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "project_goal_results"
    ADD CONSTRAINT "project_goal_results_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "project_goal_results"
    ADD CONSTRAINT "project_goal_results_value_check" CHECK ("value" >= 0);
