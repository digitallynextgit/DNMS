-- Always-on secondaries: a secondary Account Manager per project (owner_id stays the primary) and a
-- secondary owner per project service. Additive and nullable, so the live build keeps working
-- before the new code is deployed.

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "secondary_account_manager_id" TEXT;

-- AlterTable
ALTER TABLE "project_service_owners" ADD COLUMN     "secondary_employee_id" TEXT;

-- CreateIndex
CREATE INDEX "projects_secondary_account_manager_id_idx" ON "projects"("secondary_account_manager_id");

-- CreateIndex
CREATE INDEX "project_service_owners_secondary_employee_id_idx" ON "project_service_owners"("secondary_employee_id");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_secondary_account_manager_id_fkey" FOREIGN KEY ("secondary_account_manager_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_service_owners" ADD CONSTRAINT "project_service_owners_secondary_employee_id_fkey" FOREIGN KEY ("secondary_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
