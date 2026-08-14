-- Images for email templates and campaigns.
--
-- Emails cannot carry local files: base64 data URIs are stripped by Gmail and
-- most webmail, so an image has to live at a URL the recipient's mail client can
-- fetch WITHOUT a session. Everything else in this app serves B2 objects through
-- an authenticated signed redirect, which is exactly what will not work here -
-- hence a dedicated public route keyed on this table's uuid.

CREATE TABLE "project_mailer_assets" (
  "id"            TEXT NOT NULL,
  "project_id"    TEXT NOT NULL,
  "object_key"    TEXT NOT NULL,
  "file_name"     TEXT NOT NULL,
  "content_type"  TEXT NOT NULL,
  "size"          INTEGER NOT NULL,
  "created_by_id" TEXT,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_mailer_assets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "project_mailer_assets_project_id_idx" ON "project_mailer_assets"("project_id");

ALTER TABLE "project_mailer_assets" ADD CONSTRAINT "project_mailer_assets_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_mailer_assets" ADD CONSTRAINT "project_mailer_assets_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
