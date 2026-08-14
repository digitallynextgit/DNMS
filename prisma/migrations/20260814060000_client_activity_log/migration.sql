-- Client portal activity log.
--
-- Cannot reuse audit_logs: its actor_id is a foreign key to employees, so a
-- client id is rejected outright. Separate table, own real foreign key.
CREATE TABLE "client_activity_logs" (
    "id" TEXT NOT NULL,
    "client_user_id" TEXT NOT NULL,
    "project_id" TEXT,
    "action" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "summary" TEXT,
    "changes" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_activity_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "client_activity_logs_client_user_id_created_at_idx"
    ON "client_activity_logs"("client_user_id", "created_at");
CREATE INDEX "client_activity_logs_project_id_created_at_idx"
    ON "client_activity_logs"("project_id", "created_at");
CREATE INDEX "client_activity_logs_created_at_idx"
    ON "client_activity_logs"("created_at");

ALTER TABLE "client_activity_logs"
    ADD CONSTRAINT "client_activity_logs_client_user_id_fkey"
    FOREIGN KEY ("client_user_id") REFERENCES "client_users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "client_activity_logs"
    ADD CONSTRAINT "client_activity_logs_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
