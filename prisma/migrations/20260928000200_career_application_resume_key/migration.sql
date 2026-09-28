-- Durable CV copies for public career applications (functionality audit
-- 2026-09-28). resume_url is an external link owned by the marketing site's
-- storage; if it expires the CV is gone. resume_key points at OUR copy in B2,
-- mirroring applicants.resume_key.
ALTER TABLE "career_applications" ADD COLUMN "resume_key" TEXT;
