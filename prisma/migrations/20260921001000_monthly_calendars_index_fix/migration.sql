-- Corrects two index decisions from 20260921000000_monthly_calendars.
--
-- That migration created the dated-edition rule as a PARTIAL unique index
-- (WHERE period_month IS NOT NULL). Both halves of that were wrong:
--
--   1. IT IS REDUNDANT. Every row a plain UNIQUE (project_id, name,
--      period_month) compares for the dated case already carries a real month,
--      so Postgres compares the tuples normally and rejects a second September
--      exactly as wanted. The predicate excluded only the NULL rows, which that
--      index was never enforcing anything about anyway - that is what the
--      separate `..._undated_key` partial index is for, and it stays.
--
--   2. IT DID NOT MATCH THE SCHEMA. schema.prisma declares
--      @@unique([projectId, name, periodMonth]), which is a PLAIN index. Prisma
--      7.4+ diffs partial-index predicates, so a partial index wearing the name
--      of a declared plain one reads as drift on every `migrate diff` / `db
--      push` - the precise failure the `partialIndexes` preview feature was
--      turned on to avoid.
--
-- Also drops the non-unique (project_id, name, period_month) index added
-- alongside it. A btree scans backwards, so the unique index below already
-- serves the picker's "every month of this calendar, newest first" read; the
-- second one only cost writes.
--
-- SAFE ON LIVE DATA. The plain index is created BEFORE the partial one is
-- dropped, so there is no window without the rule. It cannot fail: every row it
-- covers is already covered by the index it replaces, plus the NULL rows, which
-- a unique index never rejects.

CREATE UNIQUE INDEX IF NOT EXISTS "project_workbooks_pid_name_month_key"
    ON "project_workbooks"("project_id", "name", "period_month");

DROP INDEX IF EXISTS "project_workbooks_project_id_name_period_month_key";

ALTER INDEX "project_workbooks_pid_name_month_key"
    RENAME TO "project_workbooks_project_id_name_period_month_key";

DROP INDEX IF EXISTS "project_workbooks_project_id_name_period_month_idx";

-- ── A MONTH IS THE FIRST OF THE MONTH ────────────────────────────────────────
-- The unique index above treats "September stored as the 1st" and "September
-- stored as the 15th" as two different months, so without this a second
-- September can be created by writing any other day of it. The service always
-- writes the 1st; this is what makes that a guarantee rather than a habit.
--
-- A CHECK, not a trigger, and hand-written without a schema counterpart on
-- purpose: Prisma's differ ignores CHECK constraints entirely, which is why
-- project_deliverables_period_check has survived untouched in this folder.
ALTER TABLE "project_workbooks"
    DROP CONSTRAINT IF EXISTS "project_workbooks_period_month_check";

ALTER TABLE "project_workbooks"
    ADD CONSTRAINT "project_workbooks_period_month_check"
    CHECK ("period_month" IS NULL OR EXTRACT(DAY FROM "period_month") = 1);
