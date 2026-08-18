-- Quote-reply and pinning: both already existed in project messages, so personal
-- chat was the odd one out.
ALTER TABLE "chat_messages" ADD COLUMN "reply_to_id" TEXT;
ALTER TABLE "chat_messages" ADD COLUMN "pinned_at"   TIMESTAMP(3);
ALTER TABLE "chat_messages" ADD COLUMN "pinned_by"   TEXT;

-- SET NULL, not CASCADE: deleting a quoted message must not take the reply with
-- it. The reply keeps standing, it just stops quoting.
ALTER TABLE "chat_messages"
  ADD CONSTRAINT "chat_messages_reply_to_id_fkey"
  FOREIGN KEY ("reply_to_id") REFERENCES "chat_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "chat_messages_reply_to_id_idx" ON "chat_messages" ("reply_to_id");
-- Partial: the pinned bar asks only for the handful that are pinned.
CREATE INDEX "chat_messages_pinned_idx"
  ON "chat_messages" ("conversation_id", "pinned_at") WHERE "pinned_at" IS NOT NULL;
