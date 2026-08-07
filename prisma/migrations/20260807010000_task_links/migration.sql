-- Resource links on a task: the brief, the doc, the published page.
--
-- NOT NULL with an empty-array default so every existing row is immediately
-- valid and readers never have to handle null separately from "no links yet".
ALTER TABLE "project_tasks" ADD COLUMN "links" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
