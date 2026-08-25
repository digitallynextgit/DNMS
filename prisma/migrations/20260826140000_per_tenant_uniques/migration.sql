-- =============================================================================
-- M5 pre-flight: uniqueness that is per-COMPANY, not per-platform.
--
-- M1 gave every row a tenant, but left the unique indexes alone. Most were fine
-- without changing: a key like (employee_id, date) or (project_id, name) is
-- already scoped, because the id in it is a UUID that belongs to exactly one
-- tenant. The ones fixed here are the opposite - keyed on a name a HUMAN chose,
-- with no id to scope them:
--
--   roles(name)              two companies both want a role called "admin"
--   employees(employee_no)   two companies both start at EMP-2026-0001
--   leave_types(code)        two companies both want "CL"
--   departments(name)        two companies both have "Engineering"
--   holidays(date, name)     two companies both observe Diwali
--   projects(slug)           two agencies both have a "website-refresh"
--
-- `roles(name)` is the one that made this urgent: it makes provisioning a second
-- tenant impossible, because creating its "admin" role collides with the first
-- company's. Found by trying to create one.
--
-- NOT changed, deliberately:
--   employees(email), client_users(email) - email is the platform-wide login
--     key since M2. One address is one person, across every company.
--   hikvision_devices(device_serial)      - a physical serial really is unique.
--   *(object_key), push_subscriptions(endpoint), *_idempotency_key
--                                         - globally unique by construction.
--
-- Each index is REPLACED rather than added alongside: keeping the old global one
-- would leave the collision in place and make the new index decorative.
-- =============================================================================

-- roles(name) -> (tenant_id, name)
DROP INDEX IF EXISTS "roles_name_key";
CREATE UNIQUE INDEX IF NOT EXISTS "roles_tenant_id_name_key" ON "roles" ("tenant_id", "name");

-- employees(employee_no) -> (tenant_id, employee_no)
DROP INDEX IF EXISTS "employees_employee_no_key";
CREATE UNIQUE INDEX IF NOT EXISTS "employees_tenant_id_employee_no_key"
  ON "employees" ("tenant_id", "employee_no");

-- leave_types(code | name)
DROP INDEX IF EXISTS "leave_types_code_key";
DROP INDEX IF EXISTS "leave_types_name_key";
CREATE UNIQUE INDEX IF NOT EXISTS "leave_types_tenant_id_code_key"
  ON "leave_types" ("tenant_id", "code");
CREATE UNIQUE INDEX IF NOT EXISTS "leave_types_tenant_id_name_key"
  ON "leave_types" ("tenant_id", "name");

-- departments(code | name)
DROP INDEX IF EXISTS "departments_code_key";
DROP INDEX IF EXISTS "departments_name_key";
CREATE UNIQUE INDEX IF NOT EXISTS "departments_tenant_id_code_key"
  ON "departments" ("tenant_id", "code");
CREATE UNIQUE INDEX IF NOT EXISTS "departments_tenant_id_name_key"
  ON "departments" ("tenant_id", "name");

-- designations(title)
DROP INDEX IF EXISTS "designations_title_key";
CREATE UNIQUE INDEX IF NOT EXISTS "designations_tenant_id_title_key"
  ON "designations" ("tenant_id", "title");

-- holidays(date, name)
DROP INDEX IF EXISTS "holidays_date_name_key";
CREATE UNIQUE INDEX IF NOT EXISTS "holidays_tenant_id_date_name_key"
  ON "holidays" ("tenant_id", "date", "name");

-- projects(code | slug)
DROP INDEX IF EXISTS "projects_code_key";
DROP INDEX IF EXISTS "projects_slug_key";
CREATE UNIQUE INDEX IF NOT EXISTS "projects_tenant_id_code_key"
  ON "projects" ("tenant_id", "code");
CREATE UNIQUE INDEX IF NOT EXISTS "projects_tenant_id_slug_key"
  ON "projects" ("tenant_id", "slug");

-- photo_albums(slug)
DROP INDEX IF EXISTS "photo_albums_slug_key";
CREATE UNIQUE INDEX IF NOT EXISTS "photo_albums_tenant_id_slug_key"
  ON "photo_albums" ("tenant_id", "slug");

-- email_templates(slug)
DROP INDEX IF EXISTS "email_templates_slug_key";
CREATE UNIQUE INDEX IF NOT EXISTS "email_templates_tenant_id_slug_key"
  ON "email_templates" ("tenant_id", "slug");

-- attendance_policies(name)
DROP INDEX IF EXISTS "attendance_policies_name_key";
CREATE UNIQUE INDEX IF NOT EXISTS "attendance_policies_tenant_id_name_key"
  ON "attendance_policies" ("tenant_id", "name");

-- career_groups(mode, slug)
DROP INDEX IF EXISTS "career_groups_mode_slug_key";
CREATE UNIQUE INDEX IF NOT EXISTS "career_groups_tenant_id_mode_slug_key"
  ON "career_groups" ("tenant_id", "mode", "slug");

-- Nothing above can fail on existing data: every row belongs to one tenant
-- today, so a key that was unique globally is still unique with the tenant
-- prepended. The assertion is left here as a tripwire for re-running this on a
-- database that already has more than one.
DO $$
DECLARE dupes INT;
BEGIN
  SELECT COUNT(*) INTO dupes FROM (
    SELECT tenant_id, name FROM roles GROUP BY tenant_id, name HAVING COUNT(*) > 1
  ) d;
  IF dupes > 0 THEN
    RAISE EXCEPTION 'roles(tenant_id, name) is not unique - % duplicate group(s)', dupes;
  END IF;
END $$;
