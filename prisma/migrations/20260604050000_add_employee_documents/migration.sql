-- The EmployeeDocument model existed in the schema but the table was never
-- created in the database (pre-existing drift). Backfill it.
CREATE TABLE IF NOT EXISTS "employee_documents" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "DocumentCategory" NOT NULL DEFAULT 'OTHER',
    "file_name" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "object_key" TEXT NOT NULL,
    "uploaded_by_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "employee_documents_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "employee_documents_employee_id_idx" ON "employee_documents"("employee_id");
CREATE INDEX IF NOT EXISTS "employee_documents_category_idx" ON "employee_documents"("category");
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
