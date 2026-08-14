-- Uptime monitoring + renewal register.
--
-- Motivated by the 14 Aug domain outage: the registrar's auto-renewal failed
-- repeatedly from 8 Aug with nobody acting on the emails, and the site was then
-- down for eleven hours before anyone noticed, because the only thing being
-- watched was order flow. These two tables address the two halves separately -
-- catch the expiry early, and cap the damage when something still slips through.

CREATE TYPE "MonitoredAssetKind" AS ENUM ('DOMAIN', 'SSL', 'HOSTING', 'LICENSE', 'OTHER');
CREATE TYPE "UptimeState" AS ENUM ('UNKNOWN', 'UP', 'DOWN');

-- ---------------------------------------------------------------------------
-- Renewal register
-- ---------------------------------------------------------------------------
CREATE TABLE "project_assets" (
  "id"                 TEXT NOT NULL,
  "project_id"         TEXT NOT NULL,
  "kind"               "MonitoredAssetKind" NOT NULL DEFAULT 'DOMAIN',
  "name"               TEXT NOT NULL,
  "provider"           TEXT,
  "url"                TEXT,
  "expires_at"         DATE NOT NULL,
  "auto_renew"         BOOLEAN NOT NULL DEFAULT true,
  "payment_method"     TEXT,
  "payment_expires_at" DATE,
  "owner_id"           TEXT,
  "notes"              TEXT,
  "last_alert_stage"   INTEGER,
  "last_alert_at"      TIMESTAMP(3),
  "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"         TIMESTAMP(3) NOT NULL,

  CONSTRAINT "project_assets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "project_assets_project_id_idx" ON "project_assets"("project_id");
-- The register's main query is "what expires in the next N days", across every
-- project - so the date is indexed on its own, not just under project_id.
CREATE INDEX "project_assets_expires_at_idx" ON "project_assets"("expires_at");

ALTER TABLE "project_assets"
  ADD CONSTRAINT "project_assets_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_assets"
  ADD CONSTRAINT "project_assets_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Uptime monitors
-- ---------------------------------------------------------------------------
CREATE TABLE "uptime_monitors" (
  "id"                    TEXT NOT NULL,
  "project_id"            TEXT NOT NULL,
  "url"                   TEXT NOT NULL,
  "label"                 TEXT,
  "is_active"             BOOLEAN NOT NULL DEFAULT true,
  "state"                 "UptimeState" NOT NULL DEFAULT 'UNKNOWN',
  "last_checked_at"       TIMESTAMP(3),
  "last_status_code"      INTEGER,
  "last_error"            TEXT,
  "consecutive_failures"  INTEGER NOT NULL DEFAULT 0,
  "consecutive_successes" INTEGER NOT NULL DEFAULT 0,
  "owner_id"              TEXT,
  "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"            TIMESTAMP(3) NOT NULL,

  CONSTRAINT "uptime_monitors_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uptime_monitors_project_id_url_key" ON "uptime_monitors"("project_id", "url");
CREATE INDEX "uptime_monitors_is_active_idx" ON "uptime_monitors"("is_active");

ALTER TABLE "uptime_monitors"
  ADD CONSTRAINT "uptime_monitors_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "uptime_monitors"
  ADD CONSTRAINT "uptime_monitors_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Incidents
-- ---------------------------------------------------------------------------
CREATE TABLE "uptime_incidents" (
  "id"                  TEXT NOT NULL,
  "monitor_id"          TEXT NOT NULL,
  "started_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ended_at"            TIMESTAMP(3),
  "status_code"         INTEGER,
  "detail"              TEXT,
  "acknowledged_at"     TIMESTAMP(3),
  "acknowledged_by_id"  TEXT,
  "escalation_level"    INTEGER NOT NULL DEFAULT 0,
  "last_escalated_at"   TIMESTAMP(3),

  CONSTRAINT "uptime_incidents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "uptime_incidents_monitor_id_started_at_idx"
  ON "uptime_incidents"("monitor_id", "started_at");
-- Finding the OPEN incident (ended_at IS NULL) is the hot path on every tick.
CREATE INDEX "uptime_incidents_ended_at_idx" ON "uptime_incidents"("ended_at");

ALTER TABLE "uptime_incidents"
  ADD CONSTRAINT "uptime_incidents_monitor_id_fkey"
  FOREIGN KEY ("monitor_id") REFERENCES "uptime_monitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "uptime_incidents"
  ADD CONSTRAINT "uptime_incidents_acknowledged_by_id_fkey"
  FOREIGN KEY ("acknowledged_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
