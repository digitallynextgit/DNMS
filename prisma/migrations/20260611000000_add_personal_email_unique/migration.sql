-- Enforce that personal email is unique across employees (nullable: multiple
-- NULLs remain allowed in PostgreSQL). Cross-column uniqueness (a personal email
-- not matching another employee's work email) is enforced in application code.
CREATE UNIQUE INDEX "employees_personal_email_key" ON "employees"("personal_email");
