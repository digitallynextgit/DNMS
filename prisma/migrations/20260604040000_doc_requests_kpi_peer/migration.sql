-- Document requests (HR asks an employee to upload something)
CREATE TABLE IF NOT EXISTS "document_requests" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "requested_by_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "DocumentCategory" NOT NULL DEFAULT 'OTHER',
    "note" TEXT,
    "due_date" DATE,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "document_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "document_requests_employee_id_idx" ON "document_requests"("employee_id");
CREATE INDEX IF NOT EXISTS "document_requests_status_idx" ON "document_requests"("status");
ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- KPI definitions
CREATE TABLE IF NOT EXISTS "kpis" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "kpis_pkey" PRIMARY KEY ("id")
);

-- Peer / 360 feedback
CREATE TABLE IF NOT EXISTS "peer_feedback" (
    "id" TEXT NOT NULL,
    "review_id" TEXT NOT NULL,
    "reviewer_id" TEXT NOT NULL,
    "rating" DOUBLE PRECISION,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "peer_feedback_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "peer_feedback_review_id_reviewer_id_key" ON "peer_feedback"("review_id", "reviewer_id");
ALTER TABLE "peer_feedback" ADD CONSTRAINT "peer_feedback_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "performance_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "peer_feedback" ADD CONSTRAINT "peer_feedback_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Cycle close + KPI scores on reviews
ALTER TABLE "review_cycles" ADD COLUMN IF NOT EXISTS "is_closed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "performance_reviews" ADD COLUMN IF NOT EXISTS "kpi_scores" JSONB;
