-- Weekly reviews after the 15-day joinee scorecard: every Friday for 90 days, by the reporting
-- manager. Additive, so the live build keeps working before the new code is deployed.
-- Hand-written; apply with `npx prisma migrate deploy`.

CREATE TABLE IF NOT EXISTS "joinee_weekly_reviews" (
    "tenant_id"     TEXT NOT NULL DEFAULT '0197d1ab-0000-7000-8000-000000000001',
    "id"            TEXT NOT NULL,
    "employee_id"   TEXT NOT NULL,
    "created_by_id" TEXT,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "joinee_weekly_reviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "joinee_weekly_reviews_employee_id_key"
    ON "joinee_weekly_reviews"("employee_id");
CREATE INDEX IF NOT EXISTS "joinee_weekly_reviews_tenant_id_idx"
    ON "joinee_weekly_reviews"("tenant_id");

ALTER TABLE "joinee_weekly_reviews"
    ADD CONSTRAINT "joinee_weekly_reviews_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "joinee_weekly_reviews"
    ADD CONSTRAINT "joinee_weekly_reviews_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "joinee_weekly_review_weeks" (
    "tenant_id"      TEXT NOT NULL DEFAULT '0197d1ab-0000-7000-8000-000000000001',
    "id"             TEXT NOT NULL,
    "review_id"      TEXT NOT NULL,
    "week_number"    INTEGER NOT NULL,
    "date"           DATE NOT NULL,
    "params"         JSONB NOT NULL,
    "scores"         JSONB,
    "comment"        TEXT,
    "reviewed_by_id" TEXT,
    "reviewed_at"    TIMESTAMP(3),
    "updated_at"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "joinee_weekly_review_weeks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "joinee_weekly_review_weeks_review_id_week_number_key"
    ON "joinee_weekly_review_weeks"("review_id", "week_number");
CREATE INDEX IF NOT EXISTS "joinee_weekly_review_weeks_date_idx"
    ON "joinee_weekly_review_weeks"("date");
CREATE INDEX IF NOT EXISTS "joinee_weekly_review_weeks_tenant_id_idx"
    ON "joinee_weekly_review_weeks"("tenant_id");

ALTER TABLE "joinee_weekly_review_weeks"
    ADD CONSTRAINT "joinee_weekly_review_weeks_review_id_fkey"
    FOREIGN KEY ("review_id") REFERENCES "joinee_weekly_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "joinee_weekly_review_weeks"
    ADD CONSTRAINT "joinee_weekly_review_weeks_reviewed_by_id_fkey"
    FOREIGN KEY ("reviewed_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "joinee_weekly_review_weeks"
    ADD CONSTRAINT "joinee_weekly_review_weeks_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "joinee_weekly_review_params" (
    "tenant_id"     TEXT NOT NULL DEFAULT '0197d1ab-0000-7000-8000-000000000001',
    "id"            TEXT NOT NULL,
    "key"           TEXT NOT NULL,
    "label"         TEXT NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active"     BOOLEAN NOT NULL DEFAULT true,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "joinee_weekly_review_params_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "joinee_weekly_review_params_tenant_id_key_key"
    ON "joinee_weekly_review_params"("tenant_id", "key");
CREATE INDEX IF NOT EXISTS "joinee_weekly_review_params_tenant_id_idx"
    ON "joinee_weekly_review_params"("tenant_id");

ALTER TABLE "joinee_weekly_review_params"
    ADD CONSTRAINT "joinee_weekly_review_params_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
