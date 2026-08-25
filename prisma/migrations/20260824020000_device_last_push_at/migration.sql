-- When a terminal last PUSHED a punch to /api/attendance/hook.
--
-- `last_sync_at` is stamped by both the pull sync and the push hook, so it
-- cannot answer "is realtime actually working, or is a cron just polling?".
-- This column is written only by the hook, so the Devices page can report the
-- live path honestly instead of inferring it.
ALTER TABLE "hikvision_devices" ADD COLUMN IF NOT EXISTS "last_push_at" TIMESTAMP(3);
