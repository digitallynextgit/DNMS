-- Performance evaluation: reusable templates + per-period self/manager scorecards.
CREATE TABLE IF NOT EXISTS "evaluation_templates" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "section_a_label" TEXT NOT NULL DEFAULT 'Role Performance (KRA & KPI)',
  "section_b_label" TEXT NOT NULL DEFAULT 'Workplace Discipline & Execution Effectiveness',
  "criteria" JSONB NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "evaluation_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "evaluations" (
  "id" TEXT NOT NULL,
  "template_id" TEXT,
  "criteria" JSONB NOT NULL,
  "section_a_label" TEXT NOT NULL,
  "section_b_label" TEXT NOT NULL,
  "employee_id" TEXT NOT NULL,
  "manager_id" TEXT,
  "period_label" TEXT NOT NULL,
  "period_start" DATE,
  "period_end" DATE,
  "due_date" DATE,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "self_ratings" JSONB,
  "manager_ratings" JSONB,
  "self_comment" TEXT,
  "manager_comment" TEXT,
  "self_submitted_at" TIMESTAMP(3),
  "manager_submitted_at" TIMESTAMP(3),
  "final_score" DOUBLE PRECISION,
  "created_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "evaluations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "evaluations_employee_id_idx" ON "evaluations"("employee_id");
CREATE INDEX IF NOT EXISTS "evaluations_manager_id_idx" ON "evaluations"("manager_id");
CREATE INDEX IF NOT EXISTS "evaluations_status_idx" ON "evaluations"("status");

DO $$ BEGIN
  ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_template_id_fkey"
    FOREIGN KEY ("template_id") REFERENCES "evaluation_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_manager_id_fkey"
    FOREIGN KEY ("manager_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
