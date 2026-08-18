-- Videos and stickers are attachments that render differently; polls, events and
-- shared contacts are their own thing.
ALTER TYPE "ChatAttachmentKind" ADD VALUE IF NOT EXISTS 'VIDEO';
ALTER TYPE "ChatAttachmentKind" ADD VALUE IF NOT EXISTS 'STICKER';

-- One set of tables for both surfaces. Each row hangs off EITHER a chat message
-- or a project reply; a parallel copy per surface is the one that drifts when a
-- bug gets fixed in the other.
CREATE TABLE "message_polls" (
  "id"               TEXT NOT NULL,
  "chat_message_id"  TEXT,
  "project_reply_id" TEXT,
  "question"         TEXT NOT NULL,
  "allow_multiple"   BOOLEAN NOT NULL DEFAULT false,
  "closes_at"        TIMESTAMP(3),
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "message_polls_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "message_polls_chat_message_id_key"  ON "message_polls" ("chat_message_id");
CREATE UNIQUE INDEX "message_polls_project_reply_id_key" ON "message_polls" ("project_reply_id");

CREATE TABLE "message_poll_options" (
  "id"       TEXT NOT NULL,
  "poll_id"  TEXT NOT NULL,
  "label"    TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  CONSTRAINT "message_poll_options_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "message_poll_options_poll_id_idx" ON "message_poll_options" ("poll_id");

CREATE TABLE "message_poll_votes" (
  "id"        TEXT NOT NULL,
  "option_id" TEXT NOT NULL,
  "voter_id"  TEXT NOT NULL,
  "voted_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "message_poll_votes_pkey" PRIMARY KEY ("id")
);
-- The database, not the handler, is what makes double voting impossible.
CREATE UNIQUE INDEX "message_poll_votes_option_id_voter_id_key"
  ON "message_poll_votes" ("option_id", "voter_id");
CREATE INDEX "message_poll_votes_voter_id_idx" ON "message_poll_votes" ("voter_id");

CREATE TABLE "message_events" (
  "id"               TEXT NOT NULL,
  "chat_message_id"  TEXT,
  "project_reply_id" TEXT,
  "title"            TEXT NOT NULL,
  "starts_at"        TIMESTAMP(3) NOT NULL,
  "ends_at"          TIMESTAMP(3),
  "location"         TEXT,
  "notes"            TEXT,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "message_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "message_events_chat_message_id_key"  ON "message_events" ("chat_message_id");
CREATE UNIQUE INDEX "message_events_project_reply_id_key" ON "message_events" ("project_reply_id");

-- Snapshotted, not joined live: a shared contact is a message about who someone
-- was at the time, and must not rewrite itself when they change role or leave.
CREATE TABLE "message_contacts" (
  "id"               TEXT NOT NULL,
  "chat_message_id"  TEXT,
  "project_reply_id" TEXT,
  "employee_id"      TEXT,
  "name"             TEXT NOT NULL,
  "email"            TEXT,
  "phone"            TEXT,
  "designation"      TEXT,
  "photo"            TEXT,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "message_contacts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "message_contacts_chat_message_id_key"  ON "message_contacts" ("chat_message_id");
CREATE UNIQUE INDEX "message_contacts_project_reply_id_key" ON "message_contacts" ("project_reply_id");

ALTER TABLE "message_polls" ADD CONSTRAINT "message_polls_chat_message_id_fkey"
  FOREIGN KEY ("chat_message_id") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "message_polls" ADD CONSTRAINT "message_polls_project_reply_id_fkey"
  FOREIGN KEY ("project_reply_id") REFERENCES "project_message_replies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "message_poll_options" ADD CONSTRAINT "message_poll_options_poll_id_fkey"
  FOREIGN KEY ("poll_id") REFERENCES "message_polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "message_poll_votes" ADD CONSTRAINT "message_poll_votes_option_id_fkey"
  FOREIGN KEY ("option_id") REFERENCES "message_poll_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "message_poll_votes" ADD CONSTRAINT "message_poll_votes_voter_id_fkey"
  FOREIGN KEY ("voter_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "message_events" ADD CONSTRAINT "message_events_chat_message_id_fkey"
  FOREIGN KEY ("chat_message_id") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "message_events" ADD CONSTRAINT "message_events_project_reply_id_fkey"
  FOREIGN KEY ("project_reply_id") REFERENCES "project_message_replies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "message_contacts" ADD CONSTRAINT "message_contacts_chat_message_id_fkey"
  FOREIGN KEY ("chat_message_id") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "message_contacts" ADD CONSTRAINT "message_contacts_project_reply_id_fkey"
  FOREIGN KEY ("project_reply_id") REFERENCES "project_message_replies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "message_contacts" ADD CONSTRAINT "message_contacts_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Exactly one parent, never both, never neither.
ALTER TABLE "message_polls" ADD CONSTRAINT "message_polls_one_parent"
  CHECK (("chat_message_id" IS NULL) <> ("project_reply_id" IS NULL));
ALTER TABLE "message_events" ADD CONSTRAINT "message_events_one_parent"
  CHECK (("chat_message_id" IS NULL) <> ("project_reply_id" IS NULL));
ALTER TABLE "message_contacts" ADD CONSTRAINT "message_contacts_one_parent"
  CHECK (("chat_message_id" IS NULL) <> ("project_reply_id" IS NULL));
