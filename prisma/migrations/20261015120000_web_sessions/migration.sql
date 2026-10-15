-- Browser sign-in registry, so people can see their signed-in devices and sign one out. Additive,
-- so the live build keeps working before the new code is deployed. Hand-written; apply with
-- `npx prisma migrate deploy`.

CREATE TABLE IF NOT EXISTS "web_sessions" (
    "id"           TEXT NOT NULL,
    "user_id"      TEXT NOT NULL,
    "employee_id"  TEXT,
    "ip"           TEXT,
    "user_agent"   TEXT,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at"   TIMESTAMP(3),

    CONSTRAINT "web_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "web_sessions_user_id_revoked_at_idx" ON "web_sessions"("user_id", "revoked_at");

ALTER TABLE "web_sessions"
    ADD CONSTRAINT "web_sessions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
