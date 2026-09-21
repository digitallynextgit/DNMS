-- Monthly calendars, and the per-team plan that hangs off one.
--
-- Hand-written to match the rest of this folder. Additive apart from the unique
-- index on project_workbooks, which is REPLACED rather than dropped - see below.
--
-- ── WHY period_month IS NULLABLE ─────────────────────────────────────────────
-- Every calendar that exists today predates the column, and several of them
-- encode their month in the NAME instead ("Performance Marketing Calendar
-- (H2S-Sept)"). Parsing those names into dates is the one thing this migration
-- deliberately does not do: a regex over free text would silently mis-date real
-- calendars, and a wrong month is worse than no month, because the app would
-- then file the sheet under a month nobody chose. They stay NULL - "undated" -
-- and somebody sets the month by hand, per calendar, from the UI.

ALTER TABLE "project_workbooks"
    ADD COLUMN IF NOT EXISTS "period_month" DATE;

-- ── WHY TWO PARTIAL UNIQUE INDEXES AND NOT ONE THREE-COLUMN ONE ──────────────
-- The rule is "one calendar of a given name per month", which reads as
-- UNIQUE (project_id, name, period_month). But Postgres counts NULLs as
-- DISTINCT in a unique index, so that index alone permits any number of
-- *undated* calendars sharing a name on one project - a regression, since
-- project_workbooks_project_id_name_key forbade exactly that until now.
--
-- Splitting it in two states both halves of the rule explicitly:
--   dated rows   - unique per (project, name, month)
--   undated rows - unique per (project, name), as before
--
-- UNIQUE NULLS NOT DISTINCT would express this in one index, but it needs
-- Postgres 15+ and nothing in this repo pins the server version. Partial
-- indexes work on every version that runs the rest of this schema.
--
-- Prisma's DSL cannot describe a partial index, so schema.prisma carries the
-- plain @@unique([projectId, name, periodMonth]) for the generated client's
-- compound-key types. These two indexes are the real constraint.
DROP INDEX IF EXISTS "project_workbooks_project_id_name_key";

CREATE UNIQUE INDEX IF NOT EXISTS "project_workbooks_project_id_name_period_month_key"
    ON "project_workbooks"("project_id", "name", "period_month")
    WHERE "period_month" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "project_workbooks_project_id_name_undated_key"
    ON "project_workbooks"("project_id", "name")
    WHERE "period_month" IS NULL;

-- The month picker's query: every edition of one calendar, in month order.
CREATE INDEX IF NOT EXISTS "project_workbooks_project_id_name_period_month_idx"
    ON "project_workbooks"("project_id", "name", "period_month");

-- ── ONE TEAM'S COMMITMENT ON ONE CALENDAR ────────────────────────────────────
-- quantity is NOT NULL DEFAULT 0 rather than nullable: "on the calendar but not
-- yet quantified" is a real state that 0 says perfectly well, and a nullable
-- count would make every sum in the app reach for COALESCE.
--
-- CASCADE from both parents. A team's row on a calendar has no meaning without
-- the calendar, and none without the team either - unlike the FILES below,
-- which outlive it.
CREATE TABLE IF NOT EXISTS "project_workbook_teams" (
    "tenant_id"     TEXT NOT NULL DEFAULT '0197d1ab-0000-7000-8000-000000000001',
    "id"            TEXT NOT NULL,
    "workbook_id"   TEXT NOT NULL,
    "team_id"       TEXT NOT NULL,
    "quantity"      INTEGER NOT NULL DEFAULT 0,
    "due_on"        DATE,
    "links"         TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "notes"         TEXT,
    "created_by_id" TEXT,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_workbook_teams_pkey" PRIMARY KEY ("id")
);

-- A second row for VIDEO would be a second answer to "what does VIDEO owe this
-- month". There is only one.
CREATE UNIQUE INDEX IF NOT EXISTS "project_workbook_teams_workbook_id_team_id_key"
    ON "project_workbook_teams"("workbook_id", "team_id");
CREATE INDEX IF NOT EXISTS "project_workbook_teams_workbook_id_idx"
    ON "project_workbook_teams"("workbook_id");
CREATE INDEX IF NOT EXISTS "project_workbook_teams_team_id_idx"
    ON "project_workbook_teams"("team_id");
-- "What is due, soonest first."
CREATE INDEX IF NOT EXISTS "project_workbook_teams_due_on_idx"
    ON "project_workbook_teams"("due_on");
CREATE INDEX IF NOT EXISTS "project_workbook_teams_tenant_id_idx"
    ON "project_workbook_teams"("tenant_id");

ALTER TABLE "project_workbook_teams"
    ADD CONSTRAINT "project_workbook_teams_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "project_workbook_teams"
    ADD CONSTRAINT "project_workbook_teams_workbook_id_fkey"
    FOREIGN KEY ("workbook_id") REFERENCES "project_workbooks"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_workbook_teams"
    ADD CONSTRAINT "project_workbook_teams_team_id_fkey"
    FOREIGN KEY ("team_id") REFERENCES "project_teams"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- SET NULL: who drew the plan up is worth keeping, but losing the attribution
-- when they leave must not take the plan with it.
ALTER TABLE "project_workbook_teams"
    ADD CONSTRAINT "project_workbook_teams_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "employees"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ── WHO, SPECIFICALLY, IS ON THAT ROW ────────────────────────────────────────
-- Narrower than the team's full membership on purpose: VIDEO may be six people,
-- but this month's calendar is Dev's.
--
-- workbook_id is denormalised from the parent row for one reason: it is the
-- only way to express "one team per calendar per person" as a CONSTRAINT rather
-- than as a convention the app has to remember. project_team_members carries
-- project_id for exactly the same reason.
CREATE TABLE IF NOT EXISTS "project_workbook_team_members" (
    "tenant_id"        TEXT NOT NULL DEFAULT '0197d1ab-0000-7000-8000-000000000001',
    "id"               TEXT NOT NULL,
    "workbook_team_id" TEXT NOT NULL,
    "workbook_id"      TEXT NOT NULL,
    "employee_id"      TEXT NOT NULL,
    "added_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_workbook_team_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_workbook_team_members_workbook_team_id_employee_id_key"
    ON "project_workbook_team_members"("workbook_team_id", "employee_id");
CREATE UNIQUE INDEX IF NOT EXISTS "project_workbook_team_members_workbook_id_employee_id_key"
    ON "project_workbook_team_members"("workbook_id", "employee_id");
CREATE INDEX IF NOT EXISTS "project_workbook_team_members_workbook_team_id_idx"
    ON "project_workbook_team_members"("workbook_team_id");
CREATE INDEX IF NOT EXISTS "project_workbook_team_members_employee_id_idx"
    ON "project_workbook_team_members"("employee_id");
CREATE INDEX IF NOT EXISTS "project_workbook_team_members_tenant_id_idx"
    ON "project_workbook_team_members"("tenant_id");

ALTER TABLE "project_workbook_team_members"
    ADD CONSTRAINT "project_workbook_team_members_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "project_workbook_team_members"
    ADD CONSTRAINT "project_workbook_team_members_workbook_team_id_fkey"
    FOREIGN KEY ("workbook_team_id") REFERENCES "project_workbook_teams"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- CASCADE, not SET NULL: a seat with nobody in it is not a record of anything.
ALTER TABLE "project_workbook_team_members"
    ADD CONSTRAINT "project_workbook_team_members_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ── FILES A TEAM PRODUCED AGAINST A CALENDAR ─────────────────────────────────
-- The same column shape as project_resources.deliverable_id, so calendar
-- attachments reuse the existing upload pipeline whole - video to Drive, the
-- rest to Backblaze, one size cap, one extension allowlist, one file grid.
--
-- SET NULL for the same reason deliverable_id is: deleting a PLAN must never
-- delete the WORK. The file stays in the project's files, unattached.
ALTER TABLE "project_resources"
    ADD COLUMN IF NOT EXISTS "workbook_team_id" TEXT;

CREATE INDEX IF NOT EXISTS "project_resources_workbook_team_id_idx"
    ON "project_resources"("workbook_team_id");

ALTER TABLE "project_resources"
    ADD CONSTRAINT "project_resources_workbook_team_id_fkey"
    FOREIGN KEY ("workbook_team_id") REFERENCES "project_workbook_teams"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
