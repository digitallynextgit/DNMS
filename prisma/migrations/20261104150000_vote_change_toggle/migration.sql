-- Votes: a per-event switch for changing a cast vote. Off by default, so a first vote is final.
-- Additive, so the live build keeps working before the new code is deployed. Hand-written; apply
-- with `npx prisma migrate deploy`.

ALTER TABLE "vote_events" ADD COLUMN IF NOT EXISTS "allow_vote_change" BOOLEAN NOT NULL DEFAULT false;
