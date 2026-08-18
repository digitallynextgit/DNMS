-- When the message actually reached the recipient's device. Drives the second
-- tick; the third state (read) already comes from conversation_participants.
ALTER TABLE "chat_messages" ADD COLUMN "delivered_at" TIMESTAMP(3);

-- Every lookup is "messages in these threads, from someone else, not yet
-- delivered" - without this it is a sequential scan on each app open.
CREATE INDEX "chat_messages_delivered_at_idx"
  ON "chat_messages" ("conversation_id", "delivered_at");
