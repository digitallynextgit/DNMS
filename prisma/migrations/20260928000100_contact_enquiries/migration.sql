-- Contact-form persistence (functionality audit 2026-09-28): the public
-- contact route previously only sent mail, so an SMTP outage lost the enquiry
-- with no trace. Enquiries are now stored first; email_sent records whether
-- the notification also went out.
CREATE TABLE "contact_enquiries" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT,
    "topic" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "email_sent" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_enquiries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "contact_enquiries_created_at_idx" ON "contact_enquiries"("created_at");
