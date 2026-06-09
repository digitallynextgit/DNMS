-- Rename columns in job_postings to match current schema
ALTER TABLE "job_postings" RENAME COLUMN "employment_type" TO "type";
ALTER TABLE "job_postings" RENAME COLUMN "created_by_id" TO "posted_by_id";

-- Make description nullable to match schema
ALTER TABLE "job_postings" ALTER COLUMN "description" DROP NOT NULL;
