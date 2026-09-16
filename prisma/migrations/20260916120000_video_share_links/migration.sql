-- Public share links for Drive-hosted video, served by this app.
--
-- Hand-written to match the rest of this folder. Purely additive.
--
-- ── WHY THE APP SERVES THE LINK AND NOT DRIVE ────────────────────────────────
-- The previous migration assumed Drive would publish the file ("anyone with the
-- link"). It will not: this Workspace refuses `type: anyone` outright -
--
--     reason: publishOutNotPermitted
--
-- and that is an ORGANISATION policy, not a setting on the Shared Drive (whose
-- restrictions are all false and whose capabilities report canShare: true). The
-- only way to make Drive itself publish would be to turn on external sharing for
-- the whole of digitallynext.com, which would apply to every company file rather
-- than to these videos.
--
-- So the grant lives here instead: an unguessable token, one per video, that
-- /api/public/share/<token> exchanges for a stream. That is strictly narrower
-- than the Drive route it replaces - the link covers exactly one file, and
-- clearing the column revokes it at once, whereas a Drive permission handed to
-- "anyone" keeps serving everyone who ever saved the URL.

ALTER TABLE "project_resources" ADD COLUMN IF NOT EXISTS "share_token" TEXT;
ALTER TABLE "project_resources" ADD COLUMN IF NOT EXISTS "shared_publicly_at" TIMESTAMP(3);

-- The token IS the credential, so a collision would hand one video's audience
-- another video. Unique also makes the lookup an index hit on a public route.
CREATE UNIQUE INDEX IF NOT EXISTS "project_resources_share_token_key"
    ON "project_resources"("share_token");

-- Only a Drive-hosted file can be streamed by the share route; a Backblaze row
-- has no driveFileId for it to read.
ALTER TABLE "project_resources"
    ADD CONSTRAINT "project_resources_share_needs_drive" CHECK (
        "share_token" IS NULL OR "drive_file_id" IS NOT NULL
    );

-- is_public_link is what the UI reads to decide whether to offer a Copy button,
-- and share_token is what actually makes the link work. If they can disagree,
-- the portal eventually offers a link that 404s, or hides one that is live and
-- reachable - the second being the dangerous direction.
ALTER TABLE "project_resources"
    ADD CONSTRAINT "project_resources_public_matches_token" CHECK (
        ("is_public_link" = true AND "share_token" IS NOT NULL)
     OR ("is_public_link" = false AND "share_token" IS NULL)
    );
