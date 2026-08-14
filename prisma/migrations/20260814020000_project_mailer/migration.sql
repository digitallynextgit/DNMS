-- Per-project outbound email: own SMTP, own templates, own recipients, bulk sends.
--
-- Sending is queued rather than done in the request: project_campaign_sends holds
-- one row per recipient and doubles as the work queue, so a 2,000-address blast
-- survives a restart mid-flight and can say exactly who did and didn't receive it.

CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'QUEUED', 'SENDING', 'SENT', 'FAILED', 'CANCELLED');

CREATE TABLE "project_mailers" (
  "id"               TEXT NOT NULL,
  "project_id"       TEXT NOT NULL,
  "from_name"        TEXT NOT NULL,
  "from_email"       TEXT NOT NULL,
  "reply_to"         TEXT,
  "host"             TEXT NOT NULL,
  "port"             INTEGER NOT NULL DEFAULT 587,
  "secure"           BOOLEAN NOT NULL DEFAULT false,
  "username"         TEXT NOT NULL,
  "password"         TEXT NOT NULL,
  "is_active"        BOOLEAN NOT NULL DEFAULT true,
  "last_verified_at" TIMESTAMP(3),
  "last_error"       TEXT,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "project_mailers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "project_mailers_project_id_key" ON "project_mailers"("project_id");
ALTER TABLE "project_mailers" ADD CONSTRAINT "project_mailers_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "project_email_templates" (
  "id"            TEXT NOT NULL,
  "project_id"    TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "subject"       TEXT NOT NULL,
  "body_html"     TEXT NOT NULL,
  "is_active"     BOOLEAN NOT NULL DEFAULT true,
  "created_by_id" TEXT,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "project_email_templates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "project_email_templates_project_id_name_key"
  ON "project_email_templates"("project_id", "name");
CREATE INDEX "project_email_templates_project_id_idx" ON "project_email_templates"("project_id");
ALTER TABLE "project_email_templates" ADD CONSTRAINT "project_email_templates_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_email_templates" ADD CONSTRAINT "project_email_templates_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "project_recipients" (
  "id"              TEXT NOT NULL,
  "project_id"      TEXT NOT NULL,
  "email"           TEXT NOT NULL,
  "name"            TEXT,
  "company"         TEXT,
  "tags"            TEXT[],
  "is_subscribed"   BOOLEAN NOT NULL DEFAULT true,
  "unsubscribed_at" TIMESTAMP(3),
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "project_recipients_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "project_recipients_project_id_email_key"
  ON "project_recipients"("project_id", "email");
CREATE INDEX "project_recipients_project_id_is_subscribed_idx"
  ON "project_recipients"("project_id", "is_subscribed");
ALTER TABLE "project_recipients" ADD CONSTRAINT "project_recipients_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "project_campaigns" (
  "id"            TEXT NOT NULL,
  "project_id"    TEXT NOT NULL,
  "template_id"   TEXT,
  "name"          TEXT NOT NULL,
  "subject"       TEXT NOT NULL,
  "body_html"     TEXT NOT NULL,
  "status"        "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "total_count"   INTEGER NOT NULL DEFAULT 0,
  "sent_count"    INTEGER NOT NULL DEFAULT 0,
  "failed_count"  INTEGER NOT NULL DEFAULT 0,
  "started_at"    TIMESTAMP(3),
  "completed_at"  TIMESTAMP(3),
  "created_by_id" TEXT,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "project_campaigns_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "project_campaigns_project_id_created_at_idx"
  ON "project_campaigns"("project_id", "created_at");
CREATE INDEX "project_campaigns_status_idx" ON "project_campaigns"("status");
ALTER TABLE "project_campaigns" ADD CONSTRAINT "project_campaigns_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_campaigns" ADD CONSTRAINT "project_campaigns_template_id_fkey"
  FOREIGN KEY ("template_id") REFERENCES "project_email_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "project_campaigns" ADD CONSTRAINT "project_campaigns_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "project_campaign_sends" (
  "id"           TEXT NOT NULL,
  "campaign_id"  TEXT NOT NULL,
  "recipient_id" TEXT,
  "email"        TEXT NOT NULL,
  "name"         TEXT,
  "status"       TEXT NOT NULL DEFAULT 'PENDING',
  "error"        TEXT,
  "sent_at"      TIMESTAMP(3),
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_campaign_sends_pkey" PRIMARY KEY ("id")
);
-- The queue drain looks up PENDING rows; both indexes serve that hot path.
CREATE INDEX "project_campaign_sends_campaign_id_status_idx"
  ON "project_campaign_sends"("campaign_id", "status");
CREATE INDEX "project_campaign_sends_status_idx" ON "project_campaign_sends"("status");
ALTER TABLE "project_campaign_sends" ADD CONSTRAINT "project_campaign_sends_campaign_id_fkey"
  FOREIGN KEY ("campaign_id") REFERENCES "project_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_campaign_sends" ADD CONSTRAINT "project_campaign_sends_recipient_id_fkey"
  FOREIGN KEY ("recipient_id") REFERENCES "project_recipients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
