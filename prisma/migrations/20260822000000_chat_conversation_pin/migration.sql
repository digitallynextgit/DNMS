-- Pin a conversation to the top of your own chat list.
--
-- On conversation_participants rather than conversations: pinning is private
-- housekeeping, so it must not move the chat for the person on the other side.
-- Nullable, so every existing row is simply "not pinned".
ALTER TABLE "conversation_participants" ADD COLUMN "pinned_at" TIMESTAMP(3);
