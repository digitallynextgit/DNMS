-- Emoji reactions on chat messages and on project messages/replies.
--
-- One row per (target, person, emoji). The unique keys are what make tapping the
-- same emoji twice a toggle rather than a duplicate reaction - enforced here, so
-- it holds no matter which handler wrote the row.

CREATE TABLE "chat_message_reactions" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_message_reactions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "chat_message_reactions_message_id_idx" ON "chat_message_reactions"("message_id");
CREATE UNIQUE INDEX "chat_message_reactions_message_id_employee_id_emoji_key"
    ON "chat_message_reactions"("message_id", "employee_id", "emoji");

ALTER TABLE "chat_message_reactions" ADD CONSTRAINT "chat_message_reactions_message_id_fkey"
    FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_message_reactions" ADD CONSTRAINT "chat_message_reactions_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Exactly one of message_id / reply_id is set: the opening post and a reply are
-- two different tables, but one bubble component draws both.
CREATE TABLE "project_message_reactions" (
    "id" TEXT NOT NULL,
    "message_id" TEXT,
    "reply_id" TEXT,
    "employee_id" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_message_reactions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "project_message_reactions_message_id_idx" ON "project_message_reactions"("message_id");
CREATE INDEX "project_message_reactions_reply_id_idx" ON "project_message_reactions"("reply_id");
CREATE UNIQUE INDEX "project_message_reactions_message_id_employee_id_emoji_key"
    ON "project_message_reactions"("message_id", "employee_id", "emoji");
CREATE UNIQUE INDEX "project_message_reactions_reply_id_employee_id_emoji_key"
    ON "project_message_reactions"("reply_id", "employee_id", "emoji");

ALTER TABLE "project_message_reactions" ADD CONSTRAINT "project_message_reactions_message_id_fkey"
    FOREIGN KEY ("message_id") REFERENCES "project_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_message_reactions" ADD CONSTRAINT "project_message_reactions_reply_id_fkey"
    FOREIGN KEY ("reply_id") REFERENCES "project_message_replies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_message_reactions" ADD CONSTRAINT "project_message_reactions_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
