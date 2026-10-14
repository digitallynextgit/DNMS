-- A secondary on every calendar, beside its manager (assigned_to_id): service calendars take their
-- service's secondary owner from this month on, custom calendars get their own. Additive; the live
-- build keeps working before the new code is deployed.

-- AlterTable
ALTER TABLE "project_workbooks" ADD COLUMN     "secondary_assigned_to_id" TEXT;

-- CreateIndex
CREATE INDEX "project_workbooks_secondary_assigned_to_id_idx" ON "project_workbooks"("secondary_assigned_to_id");

-- AddForeignKey
ALTER TABLE "project_workbooks" ADD CONSTRAINT "project_workbooks_secondary_assigned_to_id_fkey" FOREIGN KEY ("secondary_assigned_to_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: secondary service owners already set carry onto their service's calendars from this month
-- on, where the service's owner runs the calendar - the same rule the app follows from now on.
UPDATE "project_workbooks" w
SET "secondary_assigned_to_id" = o."secondary_employee_id"
FROM "project_service_owners" o
WHERE o."secondary_employee_id" IS NOT NULL
  AND w."project_id" = o."project_id"
  AND w."service" = o."service"
  AND w."assigned_to_id" = o."employee_id"
  AND (w."period_month" IS NULL OR w."period_month" >= date_trunc('month', now())::date);
