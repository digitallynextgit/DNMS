-- Folders + links for the project Files tab.
--
-- project_folders is the app's own tree (it is what Backblaze files and links
-- hang off); drive_folder_id points at the mirrored Google Drive sub-folder so
-- Drive files sit in the same tree. project_links stores saved URLs next to
-- the files. project_resources gains folder_id (NULL = top level).
--
-- Hand-written (migrate dev cannot create a shadow DB here - P3014), additive
-- only: two new tables, one nullable column. Nothing existing changes meaning.

CREATE TABLE "project_folders" (
    "tenant_id"       TEXT NOT NULL DEFAULT '0197d1ab-0000-7000-8000-000000000001',
    "id"              TEXT NOT NULL,
    "project_id"      TEXT NOT NULL,
    "parent_id"       TEXT,
    "name"            TEXT NOT NULL,
    "drive_folder_id" TEXT,
    "created_by_id"   TEXT NOT NULL,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_folders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_folders_drive_folder_id_key" ON "project_folders"("drive_folder_id");
CREATE INDEX "project_folders_project_id_parent_id_idx" ON "project_folders"("project_id", "parent_id");
CREATE INDEX "project_folders_tenant_id_idx" ON "project_folders"("tenant_id");

ALTER TABLE "project_folders"
    ADD CONSTRAINT "project_folders_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_folders"
    ADD CONSTRAINT "project_folders_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_folders"
    ADD CONSTRAINT "project_folders_parent_id_fkey"
    FOREIGN KEY ("parent_id") REFERENCES "project_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_folders"
    ADD CONSTRAINT "project_folders_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "project_links" (
    "tenant_id"     TEXT NOT NULL DEFAULT '0197d1ab-0000-7000-8000-000000000001',
    "id"            TEXT NOT NULL,
    "project_id"    TEXT NOT NULL,
    "folder_id"     TEXT,
    "title"         TEXT NOT NULL,
    "url"           TEXT NOT NULL,
    "tag"           "DocTag",
    "description"   TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_links_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "project_links_project_id_folder_id_idx" ON "project_links"("project_id", "folder_id");
CREATE INDEX "project_links_tenant_id_idx" ON "project_links"("tenant_id");

ALTER TABLE "project_links"
    ADD CONSTRAINT "project_links_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_links"
    ADD CONSTRAINT "project_links_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_links"
    ADD CONSTRAINT "project_links_folder_id_fkey"
    FOREIGN KEY ("folder_id") REFERENCES "project_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "project_links"
    ADD CONSTRAINT "project_links_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "project_resources" ADD COLUMN "folder_id" TEXT;

CREATE INDEX "project_resources_project_id_folder_id_idx" ON "project_resources"("project_id", "folder_id");

ALTER TABLE "project_resources"
    ADD CONSTRAINT "project_resources_folder_id_fkey"
    FOREIGN KEY ("folder_id") REFERENCES "project_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
