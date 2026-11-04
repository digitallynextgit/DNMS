-- Votes module (Company > Votes, Admin > Votes & Events): events, their options and one ballot per
-- voter per event. Additive, so the live build keeps working before the new code is deployed.
-- Hand-written; apply with `npx prisma migrate deploy`.

CREATE TABLE IF NOT EXISTS "vote_events" (
    "tenant_id"     TEXT NOT NULL DEFAULT '0197d1ab-0000-7000-8000-000000000001',
    "id"            TEXT NOT NULL,
    "title"         TEXT NOT NULL,
    "description"   TEXT,
    "opens_at"      TIMESTAMP(3),
    "closes_at"     TIMESTAMP(3) NOT NULL,
    "published_at"  TIMESTAMP(3),
    "closed_at"     TIMESTAMP(3),
    "created_by_id" TEXT NOT NULL,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vote_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "vote_events_tenant_id_idx" ON "vote_events"("tenant_id");
CREATE INDEX IF NOT EXISTS "vote_events_published_at_closes_at_idx"
    ON "vote_events"("published_at", "closes_at");

ALTER TABLE "vote_events"
    ADD CONSTRAINT "vote_events_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "vote_options" (
    "tenant_id"   TEXT NOT NULL DEFAULT '0197d1ab-0000-7000-8000-000000000001',
    "id"          TEXT NOT NULL,
    "event_id"    TEXT NOT NULL,
    "employee_id" TEXT,
    "label"       TEXT NOT NULL,
    "description" TEXT,
    "photo_key"   TEXT,
    "position"    INTEGER NOT NULL DEFAULT 0,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vote_options_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "vote_options_event_id_employee_id_key"
    ON "vote_options"("event_id", "employee_id");
CREATE INDEX IF NOT EXISTS "vote_options_event_id_idx" ON "vote_options"("event_id");
CREATE INDEX IF NOT EXISTS "vote_options_tenant_id_idx" ON "vote_options"("tenant_id");

ALTER TABLE "vote_options"
    ADD CONSTRAINT "vote_options_event_id_fkey"
    FOREIGN KEY ("event_id") REFERENCES "vote_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vote_options"
    ADD CONSTRAINT "vote_options_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "vote_ballots" (
    "tenant_id"  TEXT NOT NULL DEFAULT '0197d1ab-0000-7000-8000-000000000001',
    "id"         TEXT NOT NULL,
    "event_id"   TEXT NOT NULL,
    "option_id"  TEXT NOT NULL,
    "voter_id"   TEXT NOT NULL,
    "voted_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vote_ballots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "vote_ballots_event_id_voter_id_key"
    ON "vote_ballots"("event_id", "voter_id");
CREATE INDEX IF NOT EXISTS "vote_ballots_option_id_idx" ON "vote_ballots"("option_id");
CREATE INDEX IF NOT EXISTS "vote_ballots_tenant_id_idx" ON "vote_ballots"("tenant_id");

ALTER TABLE "vote_ballots"
    ADD CONSTRAINT "vote_ballots_event_id_fkey"
    FOREIGN KEY ("event_id") REFERENCES "vote_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vote_ballots"
    ADD CONSTRAINT "vote_ballots_option_id_fkey"
    FOREIGN KEY ("option_id") REFERENCES "vote_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vote_ballots"
    ADD CONSTRAINT "vote_ballots_voter_id_fkey"
    FOREIGN KEY ("voter_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
