-- Track the Backblaze B2 object key for an employee's profile photo so the
-- previous file can be deleted when the photo is changed or removed.
ALTER TABLE "employees" ADD COLUMN "profile_photo_key" TEXT;
