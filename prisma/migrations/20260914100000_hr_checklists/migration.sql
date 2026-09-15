-- HR checklists: onboarding and exit clearance, as data instead of a Word file
-- and a copy of an xlsx per leaver.
--
-- Hand-written (migrate dev cannot create a shadow DB here - P3014), additive
-- only: four new enum types and five new tables. Nothing existing is altered,
-- so a running build that predates this migration is unaffected.
--
-- Shape: three TEMPLATE tables (per-tenant reference data, editable like leave
-- types) and two INSTANCE tables (a snapshot of that template for one employee).
-- The instance copies section titles and item text rather than pointing at the
-- template, so editing the template cannot reword a clearance somebody already
-- signed, and a leaver's record still reads the way it did on the day they left.

CREATE TYPE "ChecklistKind" AS ENUM ('ONBOARDING', 'EXIT');
CREATE TYPE "ChecklistItemKind" AS ENUM ('TASK', 'CLEARANCE');
CREATE TYPE "ChecklistAssigneeRole" AS ENUM ('HR', 'MANAGER', 'EMPLOYEE', 'DEPARTMENT_HEAD');
CREATE TYPE "ChecklistStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- ── Templates ────────────────────────────────────────────────────────────────

CREATE TABLE "checklist_templates" (
    -- Same DB-level default as every other tenant-scoped table.
    "tenant_id"   TEXT NOT NULL DEFAULT '0197d1ab-0000-7000-8000-000000000001',
    "id"          TEXT NOT NULL,
    "kind"        "ChecklistKind" NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "is_active"   BOOLEAN NOT NULL DEFAULT true,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checklist_templates_pkey" PRIMARY KEY ("id")
);

-- One template per process per company: "the onboarding checklist" has to mean
-- one thing when an employee is created and nobody is there to choose.
CREATE UNIQUE INDEX "checklist_templates_tenant_id_kind_key" ON "checklist_templates"("tenant_id", "kind");
CREATE INDEX "checklist_templates_tenant_id_idx" ON "checklist_templates"("tenant_id");

CREATE TABLE "checklist_template_sections" (
    "tenant_id"     TEXT NOT NULL DEFAULT '0197d1ab-0000-7000-8000-000000000001',
    "id"            TEXT NOT NULL,
    "template_id"   TEXT NOT NULL,
    "title"         TEXT NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checklist_template_sections_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "checklist_template_sections_template_id_idx" ON "checklist_template_sections"("template_id");
CREATE INDEX "checklist_template_sections_tenant_id_idx" ON "checklist_template_sections"("tenant_id");

CREATE TABLE "checklist_template_items" (
    "tenant_id"               TEXT NOT NULL DEFAULT '0197d1ab-0000-7000-8000-000000000001',
    "id"                      TEXT NOT NULL,
    "section_id"              TEXT NOT NULL,
    "text"                    TEXT NOT NULL,
    "help_text"               TEXT,
    "item_kind"               "ChecklistItemKind" NOT NULL DEFAULT 'TASK',
    "assignee_role"           "ChecklistAssigneeRole" NOT NULL DEFAULT 'HR',
    -- Finance and IT/Admin have no dedicated structure anywhere in this schema,
    -- so they are whichever Department the company points a clearance at.
    "clearance_department_id" TEXT,
    "is_required"             BOOLEAN NOT NULL DEFAULT true,
    -- Days from the instance anchor (joining date / last working date).
    "offset_days"             INTEGER,
    "display_order"           INTEGER NOT NULL DEFAULT 0,
    "created_at"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"              TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checklist_template_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "checklist_template_items_section_id_idx" ON "checklist_template_items"("section_id");
CREATE INDEX "checklist_template_items_tenant_id_idx" ON "checklist_template_items"("tenant_id");

-- ── Instances ────────────────────────────────────────────────────────────────

CREATE TABLE "checklist_instances" (
    "tenant_id"        TEXT NOT NULL DEFAULT '0197d1ab-0000-7000-8000-000000000001',
    "id"               TEXT NOT NULL,
    "kind"             "ChecklistKind" NOT NULL,
    "employee_id"      TEXT NOT NULL,
    "resignation_id"   TEXT,
    -- Provenance only, nulled if the template goes: the snapshot stands alone.
    "template_id"      TEXT,
    "status"           "ChecklistStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "anchor_date"      DATE,
    "started_by_id"    TEXT,
    "completed_at"     TIMESTAMP(3),
    "completed_by_id"  TEXT,
    "cancel_reason"    TEXT,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checklist_instances_pkey" PRIMARY KEY ("id")
);

-- One exit checklist per resignation.
CREATE UNIQUE INDEX "checklist_instances_resignation_id_key" ON "checklist_instances"("resignation_id");
CREATE INDEX "checklist_instances_employee_id_idx" ON "checklist_instances"("employee_id");
CREATE INDEX "checklist_instances_kind_status_idx" ON "checklist_instances"("kind", "status");
CREATE INDEX "checklist_instances_status_idx" ON "checklist_instances"("status");
CREATE INDEX "checklist_instances_tenant_id_idx" ON "checklist_instances"("tenant_id");

CREATE TABLE "checklist_instance_items" (
    "tenant_id"      TEXT NOT NULL DEFAULT '0197d1ab-0000-7000-8000-000000000001',
    "id"             TEXT NOT NULL,
    "instance_id"    TEXT NOT NULL,
    -- Denormalised from the template on purpose - see the header.
    "section_title"  TEXT NOT NULL,
    "text"           TEXT NOT NULL,
    "help_text"      TEXT,
    "item_kind"      "ChecklistItemKind" NOT NULL DEFAULT 'TASK',
    "assignee_role"  "ChecklistAssigneeRole" NOT NULL DEFAULT 'HR',
    -- Null means the HR pool: anyone with the write scope may action it.
    "assignee_id"    TEXT,
    "is_required"    BOOLEAN NOT NULL DEFAULT true,
    "due_date"       DATE,
    "display_order"  INTEGER NOT NULL DEFAULT 0,
    "is_ad_hoc"      BOOLEAN NOT NULL DEFAULT false,
    "is_done"        BOOLEAN NOT NULL DEFAULT false,
    "done_at"        TIMESTAMP(3),
    "done_by_id"     TEXT,
    "note"           TEXT,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checklist_instance_items_pkey" PRIMARY KEY ("id"),
    -- A done item must record when and by whom, so a sign-off is always
    -- attributable. The two are written together or not at all.
    CONSTRAINT "checklist_instance_items_done_attributed" CHECK (
        "is_done" = false OR "done_at" IS NOT NULL
    )
);

CREATE INDEX "checklist_instance_items_instance_id_idx" ON "checklist_instance_items"("instance_id");
-- Drives the "awaiting my sign-off" inbox.
CREATE INDEX "checklist_instance_items_assignee_id_is_done_idx" ON "checklist_instance_items"("assignee_id", "is_done");
CREATE INDEX "checklist_instance_items_tenant_id_idx" ON "checklist_instance_items"("tenant_id");

-- ── Foreign keys ─────────────────────────────────────────────────────────────
-- tenant   -> RESTRICT (a customer must not be erasable by accident)
-- parent   -> CASCADE  (a template's sections/items, an instance's items)
-- actor    -> SET NULL (a record outlives whoever signed it)

ALTER TABLE "checklist_templates"
    ADD CONSTRAINT "checklist_templates_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "checklist_template_sections"
    ADD CONSTRAINT "checklist_template_sections_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "checklist_template_sections"
    ADD CONSTRAINT "checklist_template_sections_template_id_fkey"
    FOREIGN KEY ("template_id") REFERENCES "checklist_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "checklist_template_items"
    ADD CONSTRAINT "checklist_template_items_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "checklist_template_items"
    ADD CONSTRAINT "checklist_template_items_section_id_fkey"
    FOREIGN KEY ("section_id") REFERENCES "checklist_template_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "checklist_template_items"
    ADD CONSTRAINT "checklist_template_items_clearance_department_id_fkey"
    FOREIGN KEY ("clearance_department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "checklist_instances"
    ADD CONSTRAINT "checklist_instances_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "checklist_instances"
    ADD CONSTRAINT "checklist_instances_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "checklist_instances"
    ADD CONSTRAINT "checklist_instances_resignation_id_fkey"
    FOREIGN KEY ("resignation_id") REFERENCES "resignations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "checklist_instances"
    ADD CONSTRAINT "checklist_instances_template_id_fkey"
    FOREIGN KEY ("template_id") REFERENCES "checklist_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "checklist_instances"
    ADD CONSTRAINT "checklist_instances_started_by_id_fkey"
    FOREIGN KEY ("started_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "checklist_instances"
    ADD CONSTRAINT "checklist_instances_completed_by_id_fkey"
    FOREIGN KEY ("completed_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "checklist_instance_items"
    ADD CONSTRAINT "checklist_instance_items_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "checklist_instance_items"
    ADD CONSTRAINT "checklist_instance_items_instance_id_fkey"
    FOREIGN KEY ("instance_id") REFERENCES "checklist_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "checklist_instance_items"
    ADD CONSTRAINT "checklist_instance_items_assignee_id_fkey"
    FOREIGN KEY ("assignee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "checklist_instance_items"
    ADD CONSTRAINT "checklist_instance_items_done_by_id_fkey"
    FOREIGN KEY ("done_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
