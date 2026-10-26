-- Telegram as a personal notification channel: one row per employee, linked once from their
-- profile. Additive; hand-written, apply with `npx prisma migrate deploy`.

CREATE TABLE IF NOT EXISTS "telegram_links" (
    "tenant_id"       TEXT NOT NULL DEFAULT '0197d1ab-0000-7000-8000-000000000001',
    "id"              TEXT NOT NULL,
    "employee_id"     TEXT NOT NULL,
    "chat_id"         TEXT,
    "username"        TEXT,
    "code"            TEXT,
    "code_expires_at" TIMESTAMP(3),
    "linked_at"       TIMESTAMP(3),
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "telegram_links_employee_id_key" ON "telegram_links"("employee_id");
CREATE UNIQUE INDEX IF NOT EXISTS "telegram_links_code_key" ON "telegram_links"("code");
CREATE INDEX IF NOT EXISTS "telegram_links_chat_id_idx" ON "telegram_links"("chat_id");
CREATE INDEX IF NOT EXISTS "telegram_links_tenant_id_idx" ON "telegram_links"("tenant_id");

ALTER TABLE "telegram_links"
    ADD CONSTRAINT "telegram_links_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
