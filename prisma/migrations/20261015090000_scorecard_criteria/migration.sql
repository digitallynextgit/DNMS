-- Editable joinee-scorecard criteria (rename, reorder, hide, add), and a JSON column for the
-- scores of added criteria. Additive, so the live build keeps working before the new code is
-- deployed. Hand-written; apply with `npx prisma migrate deploy`.

ALTER TABLE "joinee_scorecard_days" ADD COLUMN IF NOT EXISTS "scores" JSONB;

CREATE TABLE IF NOT EXISTS "joinee_scorecard_criteria" (
    "tenant_id"     TEXT NOT NULL DEFAULT '0197d1ab-0000-7000-8000-000000000001',
    "id"            TEXT NOT NULL,
    "key"           TEXT NOT NULL,
    "side"          TEXT NOT NULL,
    "label"         TEXT NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active"     BOOLEAN NOT NULL DEFAULT true,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "joinee_scorecard_criteria_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "joinee_scorecard_criteria_tenant_id_key_key"
    ON "joinee_scorecard_criteria"("tenant_id", "key");
CREATE INDEX IF NOT EXISTS "joinee_scorecard_criteria_tenant_id_idx"
    ON "joinee_scorecard_criteria"("tenant_id");
