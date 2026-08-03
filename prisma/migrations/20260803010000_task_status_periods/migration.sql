-- One row per stretch a task spent in a single status. The row with
-- ended_at IS NULL is the status the task is in right now.
CREATE TABLE "task_status_periods" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL,
    "actor_id" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "duration_seconds" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_status_periods_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "task_status_periods_task_id_started_at_idx" ON "task_status_periods"("task_id", "started_at");

ALTER TABLE "task_status_periods" ADD CONSTRAINT "task_status_periods_task_id_fkey"
    FOREIGN KEY ("task_id") REFERENCES "project_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "task_status_periods" ADD CONSTRAINT "task_status_periods_actor_id_fkey"
    FOREIGN KEY ("actor_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Open the first period for every existing task, backdated to when the task was
-- created. Their current status is, as far as the record goes, the only one
-- they have ever had.
INSERT INTO "task_status_periods" ("id", "task_id", "status", "started_at")
SELECT gen_random_uuid()::text, "id", "status", "created_at" FROM "project_tasks";
