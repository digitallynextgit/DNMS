-- Optional Project Controller (3rd reviewer) on an evaluation.
ALTER TABLE "evaluations" ADD COLUMN IF NOT EXISTS "controller_id" TEXT;
ALTER TABLE "evaluations" ADD COLUMN IF NOT EXISTS "controller_ratings" JSONB;
ALTER TABLE "evaluations" ADD COLUMN IF NOT EXISTS "controller_comment" TEXT;
ALTER TABLE "evaluations" ADD COLUMN IF NOT EXISTS "controller_submitted_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "evaluations_controller_id_idx" ON "evaluations"("controller_id");

DO $$ BEGIN
  ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_controller_id_fkey"
    FOREIGN KEY ("controller_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
