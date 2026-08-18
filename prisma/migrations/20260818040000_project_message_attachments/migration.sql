-- Pictures, voice notes and files on project replies. Same shape as
-- chat_attachments, down to the enum, because they are the same thing on two
-- surfaces and one renderer draws both.
CREATE TABLE "project_message_attachments" (
  "id"           TEXT NOT NULL,
  "reply_id"     TEXT NOT NULL,
  "kind"         "ChatAttachmentKind" NOT NULL,
  "object_key"   TEXT NOT NULL,
  "file_name"    TEXT NOT NULL,
  "content_type" TEXT NOT NULL,
  "size"         INTEGER NOT NULL,
  "width"        INTEGER,
  "height"       INTEGER,
  "duration_sec" INTEGER,
  "waveform"     INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_message_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "project_message_attachments_reply_id_idx"
  ON "project_message_attachments" ("reply_id");

ALTER TABLE "project_message_attachments"
  ADD CONSTRAINT "project_message_attachments_reply_id_fkey"
  FOREIGN KEY ("reply_id") REFERENCES "project_message_replies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
