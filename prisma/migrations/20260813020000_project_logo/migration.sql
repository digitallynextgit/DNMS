-- Project logo.
--
-- Two columns, mirroring how employee profile photos work (employees.profile_photo
-- + profile_photo_key): `logo` is the stable route URL an <img> points at, and
-- `logo_key` is the private B2 object it resolves to. Storing a bucket URL
-- directly would either need a public bucket or bake in a signed URL that expires.

ALTER TABLE "projects" ADD COLUMN "logo" TEXT;
ALTER TABLE "projects" ADD COLUMN "logo_key" TEXT;
