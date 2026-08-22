-- Quote-reply on project messages.
--
-- Two columns because a thread has two kinds of bubble - the opening post and
-- the replies under it - and a quote points at exactly one of them.
--
-- ON DELETE SET NULL, not CASCADE: deleting a quoted line must not take the
-- answer to it with it. The quote just falls back to "message deleted".
ALTER TABLE "project_message_replies" ADD COLUMN "reply_to_id" TEXT;
ALTER TABLE "project_message_replies" ADD COLUMN "reply_to_root_id" TEXT;

CREATE INDEX "project_message_replies_reply_to_id_idx" ON "project_message_replies"("reply_to_id");

ALTER TABLE "project_message_replies" ADD CONSTRAINT "project_message_replies_reply_to_id_fkey"
    FOREIGN KEY ("reply_to_id") REFERENCES "project_message_replies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "project_message_replies" ADD CONSTRAINT "project_message_replies_reply_to_root_id_fkey"
    FOREIGN KEY ("reply_to_root_id") REFERENCES "project_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
