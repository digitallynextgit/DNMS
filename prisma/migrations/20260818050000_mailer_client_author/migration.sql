-- The mailer is the one surface staff and client-portal accounts share, but the
-- author columns only pointed at employees - so every write by a client failed
-- with a foreign key violation and surfaced as a 500. Each of these tables now
-- records a client author too; exactly one of the two is ever set.
ALTER TABLE "project_campaigns"       ADD COLUMN "created_by_client_id" TEXT;
ALTER TABLE "project_email_templates" ADD COLUMN "created_by_client_id" TEXT;
ALTER TABLE "project_mailer_assets"   ADD COLUMN "created_by_client_id" TEXT;

ALTER TABLE "project_campaigns"
  ADD CONSTRAINT "project_campaigns_created_by_client_id_fkey"
  FOREIGN KEY ("created_by_client_id") REFERENCES "client_users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "project_email_templates"
  ADD CONSTRAINT "project_email_templates_created_by_client_id_fkey"
  FOREIGN KEY ("created_by_client_id") REFERENCES "client_users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "project_mailer_assets"
  ADD CONSTRAINT "project_mailer_assets_created_by_client_id_fkey"
  FOREIGN KEY ("created_by_client_id") REFERENCES "client_users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Nothing may claim both authors at once: the UI picks a name by checking one
-- then the other, and a row with both would silently show the wrong one.
ALTER TABLE "project_campaigns"
  ADD CONSTRAINT "project_campaigns_one_author"
  CHECK ("created_by_id" IS NULL OR "created_by_client_id" IS NULL);
ALTER TABLE "project_email_templates"
  ADD CONSTRAINT "project_email_templates_one_author"
  CHECK ("created_by_id" IS NULL OR "created_by_client_id" IS NULL);
ALTER TABLE "project_mailer_assets"
  ADD CONSTRAINT "project_mailer_assets_one_author"
  CHECK ("created_by_id" IS NULL OR "created_by_client_id" IS NULL);
