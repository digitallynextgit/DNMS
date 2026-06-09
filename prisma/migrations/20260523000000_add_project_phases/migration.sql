-- ─── ProjectPhase ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "project_phases" (
    "id"            TEXT NOT NULL,
    "name"          TEXT NOT NULL,
    "description"   TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active"     BOOLEAN NOT NULL DEFAULT true,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "project_phases_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_phases_name_key" ON "project_phases"("name");

-- ─── projects.current_phase_id ───────────────────────────────────────────────
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "current_phase_id" TEXT;

CREATE INDEX IF NOT EXISTS "projects_current_phase_id_idx" ON "projects"("current_phase_id");

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_current_phase_id_fkey"
  FOREIGN KEY ("current_phase_id") REFERENCES "project_phases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
