-- "Delete for me": per-viewer hiding, alongside the existing "delete for
-- everyone" soft delete.
ALTER TABLE "chat_messages" ADD COLUMN "hidden_for" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
