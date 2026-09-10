-- The window a commitment covers, not just the day it runs out.
--
-- "Three reels a week" is owed ACROSS a week; due_on could only ever record
-- when that week ended, so the board said "due 2 Oct" for something that was
-- really "28 Sep - 4 Oct". The account manager now picks the period first and
-- the teams inside it, so the period is the thing that needs storing.
--
-- Hand-written (migrate dev cannot create a shadow DB here - P3014). Additive
-- and nullable: every existing row keeps its due_on and simply has no period.

ALTER TABLE "project_deliverables" ADD COLUMN "period_start" DATE;
ALTER TABLE "project_deliverables" ADD COLUMN "period_end"   DATE;

-- A period that ends before it starts is not a period.
ALTER TABLE "project_deliverables"
    ADD CONSTRAINT "project_deliverables_period_check"
    CHECK (
        ("period_start" IS NULL AND "period_end" IS NULL)
        OR ("period_start" IS NOT NULL AND "period_end" IS NOT NULL AND "period_end" >= "period_start")
    );

-- "What does this project owe over these dates" is now a first-class question.
CREATE INDEX "project_deliverables_project_id_period_start_idx"
    ON "project_deliverables"("project_id", "period_start");
