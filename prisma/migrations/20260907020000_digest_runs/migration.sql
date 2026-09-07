-- One row per digest actually sent for a period. The weekly work digest is
-- driven by an hourly scheduler tick AND an external cron route; whichever
-- fires first inserts here and the other finds the row and does nothing. The
-- unique index is the lock - no advisory locks, no in-memory flags that a
-- restart forgets.
--
-- Hand-written (migrate dev cannot create a shadow DB here - P3014), additive.

CREATE TABLE "digest_runs" (
    "tenant_id"    TEXT NOT NULL DEFAULT '0197d1ab-0000-7000-8000-000000000001',
    "id"           TEXT NOT NULL,
    -- 'weekly-work' today; room for others.
    "kind"         TEXT NOT NULL,
    "period_start" DATE NOT NULL,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "digest_runs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "digest_runs_tenant_id_kind_period_start_key" ON "digest_runs"("tenant_id", "kind", "period_start");

ALTER TABLE "digest_runs"
    ADD CONSTRAINT "digest_runs_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
