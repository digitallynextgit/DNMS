-- Admin Documents: company-wide documents only admins and HR may see.
ALTER TABLE "documents" ADD COLUMN "admin_only" BOOLEAN NOT NULL DEFAULT false;
