-- 15-day new-joinee scorecard: one per employee, with a row per evaluated
-- working day holding the manager's and HR's 1-5 scores (null = not given yet).
-- Averages, the overall score and the rating are computed in the app, never
-- stored. Hand-written (prisma migrate dev cannot create its shadow database on
-- the remote server); apply with `npx prisma migrate deploy`.
-- Both tables are new and empty, so the CHECK constraints validate instantly.
CREATE TABLE "joinee_scorecards" (
    "tenant_id" TEXT NOT NULL DEFAULT '0197d1ab-0000-7000-8000-000000000001',
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "hr_spoc_id" TEXT,
    "manager_observations" TEXT,
    "hr_observations" TEXT,
    "recommendation" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "joinee_scorecards_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "joinee_scorecards_recommendation_check" CHECK (
        "recommendation" IS NULL
        OR "recommendation" IN ('CONTINUE', 'CONTINUE_WITH_IMPROVEMENTS', 'REVIEW_REQUIRED')
    )
);

CREATE TABLE "joinee_scorecard_days" (
    "tenant_id" TEXT NOT NULL DEFAULT '0197d1ab-0000-7000-8000-000000000001',
    "id" TEXT NOT NULL,
    "scorecard_id" TEXT NOT NULL,
    "day_number" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "mgr_job_role" INTEGER,
    "mgr_communication" INTEGER,
    "mgr_learning" INTEGER,
    "hr_discipline" INTEGER,
    "hr_culture" INTEGER,
    "hr_learning" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "joinee_scorecard_days_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "joinee_scorecard_days_scores_check" CHECK (
        ("mgr_job_role" IS NULL OR "mgr_job_role" BETWEEN 1 AND 5)
        AND ("mgr_communication" IS NULL OR "mgr_communication" BETWEEN 1 AND 5)
        AND ("mgr_learning" IS NULL OR "mgr_learning" BETWEEN 1 AND 5)
        AND ("hr_discipline" IS NULL OR "hr_discipline" BETWEEN 1 AND 5)
        AND ("hr_culture" IS NULL OR "hr_culture" BETWEEN 1 AND 5)
        AND ("hr_learning" IS NULL OR "hr_learning" BETWEEN 1 AND 5)
    )
);

CREATE UNIQUE INDEX "joinee_scorecards_employee_id_key" ON "joinee_scorecards"("employee_id");
CREATE INDEX "joinee_scorecards_tenant_id_idx" ON "joinee_scorecards"("tenant_id");
CREATE UNIQUE INDEX "joinee_scorecard_days_scorecard_id_day_number_key" ON "joinee_scorecard_days"("scorecard_id", "day_number");
CREATE INDEX "joinee_scorecard_days_tenant_id_idx" ON "joinee_scorecard_days"("tenant_id");

ALTER TABLE "joinee_scorecards" ADD CONSTRAINT "joinee_scorecards_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "joinee_scorecards" ADD CONSTRAINT "joinee_scorecards_hr_spoc_id_fkey"
    FOREIGN KEY ("hr_spoc_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "joinee_scorecard_days" ADD CONSTRAINT "joinee_scorecard_days_scorecard_id_fkey"
    FOREIGN KEY ("scorecard_id") REFERENCES "joinee_scorecards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
