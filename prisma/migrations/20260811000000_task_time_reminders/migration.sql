-- Task time reminders: warn an assignee that the hours booked for a task they
-- are actively working on are about to run out.
--
-- Two tables:
--   task_reminder_preferences - per employee, WHEN and HOW OFTEN to be warned.
--     No row = the app defaults (15 minutes out, once), so an employee is warned
--     without having to opt in.
--   task_reminder_states - what has already been sent for one RUN of a task.
--     A run is a single uninterrupted IN_PROGRESS stretch, keyed by the task's
--     in_progress_since. The unique constraint is what makes the cron safe to
--     run twice or to catch up after an outage without re-sending.

CREATE TABLE "task_reminder_preferences" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lead_minutes" INTEGER NOT NULL DEFAULT 15,
    "reminder_count" INTEGER NOT NULL DEFAULT 1,
    "repeat_every_minutes" INTEGER NOT NULL DEFAULT 5,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_reminder_preferences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "task_reminder_preferences_employee_id_key"
    ON "task_reminder_preferences"("employee_id");

ALTER TABLE "task_reminder_preferences"
    ADD CONSTRAINT "task_reminder_preferences_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "task_reminder_states" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "run_started_at" TIMESTAMP(3) NOT NULL,
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "last_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_reminder_states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "task_reminder_states_task_id_run_started_at_key"
    ON "task_reminder_states"("task_id", "run_started_at");

CREATE INDEX "task_reminder_states_created_at_idx"
    ON "task_reminder_states"("created_at");

ALTER TABLE "task_reminder_states"
    ADD CONSTRAINT "task_reminder_states_task_id_fkey"
    FOREIGN KEY ("task_id") REFERENCES "project_tasks"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
