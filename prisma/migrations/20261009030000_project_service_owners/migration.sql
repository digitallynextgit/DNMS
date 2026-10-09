-- Who owns each service (a PROJECT_SERVICES code) on a project: one person per project + service.
-- New table only, so the live build keeps working before the new code is deployed. Hand-written;
-- apply with `npx prisma migrate deploy`.
CREATE TABLE "project_service_owners" (
    "tenant_id" TEXT NOT NULL DEFAULT '0197d1ab-0000-7000-8000-000000000001',
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_service_owners_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_service_owners_project_id_service_key" ON "project_service_owners"("project_id", "service");
CREATE INDEX "project_service_owners_employee_id_idx" ON "project_service_owners"("employee_id");
CREATE INDEX "project_service_owners_tenant_id_idx" ON "project_service_owners"("tenant_id");

ALTER TABLE "project_service_owners" ADD CONSTRAINT "project_service_owners_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_service_owners" ADD CONSTRAINT "project_service_owners_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
