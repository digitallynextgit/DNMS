-- Pictures, voice notes and files on chat messages.
CREATE TYPE "ChatAttachmentKind" AS ENUM ('IMAGE', 'AUDIO', 'FILE');

CREATE TABLE "chat_attachments" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "kind" "ChatAttachmentKind" NOT NULL,
    "object_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "duration_sec" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_attachments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "chat_attachments_message_id_idx" ON "chat_attachments"("message_id");
ALTER TABLE "chat_attachments" ADD CONSTRAINT "chat_attachments_message_id_fkey"
  FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
