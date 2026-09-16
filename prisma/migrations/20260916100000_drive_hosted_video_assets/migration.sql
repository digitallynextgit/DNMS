-- Video assets hosted on Google Drive instead of Backblaze.
--
-- Hand-written to match the rest of this folder (migrate dev cannot create a
-- shadow DB here - P3014). Additive except for one widening: object_key becomes
-- nullable. Dropping NOT NULL never invalidates an existing row, so every
-- deployed Backblaze asset keeps working unchanged.
--
-- ── WHY A SECOND STORE AT ALL ────────────────────────────────────────────────
-- The portal caps uploads at 20 MB and allows no video MIME type, so video could
-- not be attached to a content-plan item. Backblaze could hold the bytes, but a
-- Backblaze object is only reachable through a short-lived SIGNED url - there is
-- nothing to paste to someone outside the portal. Drive gives both the capacity
-- and a durable public link, so video goes there and everything else stays put.
--
-- ── WHY is_public_link DEFAULTS TO FALSE ─────────────────────────────────────
-- Same reasoning as is_client_visible on this table: the absence of a decision
-- must narrow access, not widen it. A row is public only because an upload
-- actually succeeded in setting the Drive permission - and a Workspace policy
-- can refuse it, in which case the file stays private and this stays false.

-- Backblaze key becomes optional; a Drive file id joins it.
ALTER TABLE "project_resources" ALTER COLUMN "object_key" DROP NOT NULL;
ALTER TABLE "project_resources" ADD COLUMN IF NOT EXISTS "drive_file_id" TEXT;
ALTER TABLE "project_resources" ADD COLUMN IF NOT EXISTS "drive_web_view_link" TEXT;
ALTER TABLE "project_resources" ADD COLUMN IF NOT EXISTS "is_public_link" BOOLEAN NOT NULL DEFAULT false;

-- One row, one home. A row with both keys means two copies of the same asset
-- drifting apart; a row with neither is a database entry pointing at no bytes at
-- all, which the storage sweep would read as an orphan and the UI as a dead
-- link. Postgres allows many NULLs in a UNIQUE index, so both columns can stay
-- unique while only one of them is ever populated.
ALTER TABLE "project_resources"
    ADD CONSTRAINT "project_resources_one_store" CHECK (
        ("object_key" IS NOT NULL AND "drive_file_id" IS NULL)
     OR ("object_key" IS NULL AND "drive_file_id" IS NOT NULL)
    );

-- A public link, a Drive URL, and a public flag are all meaningless on a
-- Backblaze row - that half of the table is served by signed urls and has no
-- Drive file to share.
ALTER TABLE "project_resources"
    ADD CONSTRAINT "project_resources_drive_fields_need_drive" CHECK (
        "drive_file_id" IS NOT NULL
     OR ("drive_web_view_link" IS NULL AND "is_public_link" = false)
    );

CREATE UNIQUE INDEX IF NOT EXISTS "project_resources_drive_file_id_key"
    ON "project_resources"("drive_file_id");
