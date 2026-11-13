-- Weekly growth scorecard: one metric line per project, one number per metric per week.
-- Additive; hand-written, apply with `npx prisma migrate deploy`.

CREATE TABLE IF NOT EXISTS "project_metrics" (
    "tenant_id"    TEXT NOT NULL DEFAULT '0197d1ab-0000-7000-8000-000000000001',
    "id"           TEXT NOT NULL,
    "project_id"   TEXT NOT NULL,
    "channel"      TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "unit"         TEXT NOT NULL DEFAULT 'NUMBER',
    "how_to"       TEXT,
    "healthy_min"  DOUBLE PRECISION,
    "healthy_max"  DOUBLE PRECISION,
    "good_when"    TEXT NOT NULL DEFAULT 'UP',
    "healthy_note" TEXT,
    "sort_order"   INTEGER NOT NULL DEFAULT 0,
    "is_active"    BOOLEAN NOT NULL DEFAULT true,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_metrics_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "project_metric_entries" (
    "tenant_id"     TEXT NOT NULL DEFAULT '0197d1ab-0000-7000-8000-000000000001',
    "id"            TEXT NOT NULL,
    "metric_id"     TEXT NOT NULL,
    "week_start"    DATE NOT NULL,
    "value"         DOUBLE PRECISION,
    "note"          TEXT,
    "entered_by_id" TEXT,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_metric_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_metrics_project_id_channel_name_key"
    ON "project_metrics" ("project_id", "channel", "name");
CREATE INDEX IF NOT EXISTS "project_metrics_project_id_sort_order_idx"
    ON "project_metrics" ("project_id", "sort_order");
CREATE INDEX IF NOT EXISTS "project_metrics_tenant_id_idx"
    ON "project_metrics" ("tenant_id");

CREATE UNIQUE INDEX IF NOT EXISTS "project_metric_entries_metric_id_week_start_key"
    ON "project_metric_entries" ("metric_id", "week_start");
CREATE INDEX IF NOT EXISTS "project_metric_entries_metric_id_week_start_idx"
    ON "project_metric_entries" ("metric_id", "week_start");
CREATE INDEX IF NOT EXISTS "project_metric_entries_tenant_id_idx"
    ON "project_metric_entries" ("tenant_id");

ALTER TABLE "project_metrics"
    ADD CONSTRAINT "project_metrics_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_metric_entries"
    ADD CONSTRAINT "project_metric_entries_metric_id_fkey"
    FOREIGN KEY ("metric_id") REFERENCES "project_metrics" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_metric_entries"
    ADD CONSTRAINT "project_metric_entries_entered_by_id_fkey"
    FOREIGN KEY ("entered_by_id") REFERENCES "employees" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
