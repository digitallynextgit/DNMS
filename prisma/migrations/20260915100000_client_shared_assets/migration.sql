-- Client-visible project files: sharing, client uploads, and an approval loop.
--
-- Hand-written (migrate dev cannot create a shadow DB here - P3014). Additive
-- except for one widening: uploaded_by_id becomes nullable so a CLIENT can be
-- recorded as the uploader. Dropping NOT NULL never invalidates an existing
-- row, so the deployed build keeps working unchanged.
--
-- ── WHY is_client_visible DEFAULTS TO FALSE ──────────────────────────────────
-- project_resources holds internal briefs, references and working files. The
-- portal reads this same table, so the default is the security model: a file
-- reaches an outsider only because somebody deliberately shared it. Existing
-- rows therefore all stay internal, which is the only safe backfill.

CREATE TYPE "AssetReviewStatus" AS ENUM ('IN_REVIEW', 'APPROVED', 'CHANGES_REQUESTED');

-- Staff uploader becomes optional; a client uploader joins it.
ALTER TABLE "project_resources" ALTER COLUMN "uploaded_by_id" DROP NOT NULL;
ALTER TABLE "project_resources" ADD COLUMN IF NOT EXISTS "uploaded_by_client_id" TEXT;

-- Sharing.
ALTER TABLE "project_resources" ADD COLUMN IF NOT EXISTS "is_client_visible" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "project_resources" ADD COLUMN IF NOT EXISTS "shared_at" TIMESTAMP(3);

-- Approval loop.
ALTER TABLE "project_resources" ADD COLUMN IF NOT EXISTS "review_status" "AssetReviewStatus";
ALTER TABLE "project_resources" ADD COLUMN IF NOT EXISTS "reviewed_at" TIMESTAMP(3);
ALTER TABLE "project_resources" ADD COLUMN IF NOT EXISTS "reviewed_by_client_id" TEXT;
ALTER TABLE "project_resources" ADD COLUMN IF NOT EXISTS "review_note" TEXT;

-- Exactly one uploader, the way memberships enforce exactly one profile. A row
-- with both, or neither, means the code lost track of who produced the file -
-- and "who uploaded this" is the question an approval trail exists to answer.
ALTER TABLE "project_resources"
    ADD CONSTRAINT "project_resources_one_uploader" CHECK (
        ("uploaded_by_id" IS NOT NULL AND "uploaded_by_client_id" IS NULL)
     OR ("uploaded_by_id" IS NULL AND "uploaded_by_client_id" IS NOT NULL)
    );

-- A review state only means something on a shared file.
ALTER TABLE "project_resources"
    ADD CONSTRAINT "project_resources_review_requires_share" CHECK (
        "review_status" IS NULL OR "is_client_visible" = true
    );

-- The portal's list: this project's shared files only.
CREATE INDEX IF NOT EXISTS "project_resources_project_id_is_client_visible_idx"
    ON "project_resources"("project_id", "is_client_visible");

-- Actor FKs are SET NULL: a file outlives the person who uploaded or reviewed
-- it, and losing the work product because an account was removed would be worse
-- than losing the attribution.
ALTER TABLE "project_resources"
    ADD CONSTRAINT "project_resources_uploaded_by_client_id_fkey"
    FOREIGN KEY ("uploaded_by_client_id") REFERENCES "client_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "project_resources"
    ADD CONSTRAINT "project_resources_reviewed_by_client_id_fkey"
    FOREIGN KEY ("reviewed_by_client_id") REFERENCES "client_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The staff uploader FK was ON DELETE CASCADE while the column was mandatory.
-- Now that it is optional, deleting an employee must NULL the column rather than
-- destroy the file: an employee leaving is not a reason to lose a client asset.
ALTER TABLE "project_resources" DROP CONSTRAINT IF EXISTS "project_resources_uploaded_by_id_fkey";
ALTER TABLE "project_resources"
    ADD CONSTRAINT "project_resources_uploaded_by_id_fkey"
    FOREIGN KEY ("uploaded_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
