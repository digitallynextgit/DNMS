-- AI providers and keys, managed in Admin -> AI Models instead of env vars. Additive, so the live
-- build keeps working before the new code is deployed. Hand-written; apply with
-- `npx prisma migrate deploy`.

CREATE TABLE IF NOT EXISTS "ai_providers" (
    "id"           TEXT NOT NULL,
    -- gemini | anthropic | openai | mistral | groq | openrouter | cerebras | custom
    "kind"         TEXT NOT NULL,
    "label"        TEXT NOT NULL,
    "base_url"     TEXT,
    "fast_models"  TEXT NOT NULL,
    "smart_models" TEXT NOT NULL,
    "is_default"   BOOLEAN NOT NULL DEFAULT false,
    "is_active"    BOOLEAN NOT NULL DEFAULT true,
    "position"     INTEGER NOT NULL DEFAULT 0,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_providers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ai_provider_keys" (
    "id"            TEXT NOT NULL,
    "provider_id"   TEXT NOT NULL,
    "label"         TEXT,
    "secret"        TEXT NOT NULL,
    "last4"         TEXT NOT NULL,
    "is_active"     BOOLEAN NOT NULL DEFAULT true,
    "position"      INTEGER NOT NULL DEFAULT 0,
    "last_used_at"  TIMESTAMP(3),
    "last_error"    TEXT,
    "last_error_at" TIMESTAMP(3),
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_provider_keys_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ai_provider_keys_provider_id_idx" ON "ai_provider_keys"("provider_id");

ALTER TABLE "ai_provider_keys"
    ADD CONSTRAINT "ai_provider_keys_provider_id_fkey"
    FOREIGN KEY ("provider_id") REFERENCES "ai_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
