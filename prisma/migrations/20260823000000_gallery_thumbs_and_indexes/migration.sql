-- Gallery thumbnails + directory/dashboard indexes.
--
-- 1. photos.thumb_key: a small (480px WebP) variant so the album grid and covers
--    stop downloading full 2000px masters to paint tiny squares. Nullable -
--    videos have none, and existing rows stay null until backfilled
--    (prisma/backfill-gallery-thumbs.ts).
ALTER TABLE "photos" ADD COLUMN "thumb_key" TEXT;

-- 2. Employee directory: default sort is created_at desc, with department /
--    designation as the optional filters. Without these the directory scans the
--    whole employees table on every page.
CREATE INDEX "employees_created_at_idx" ON "employees"("created_at");
CREATE INDEX "employees_department_id_idx" ON "employees"("department_id");
CREATE INDEX "employees_designation_id_idx" ON "employees"("designation_id");

-- 3. Admin dashboard org-wide unread count (WHERE is_read = false, no
--    employee_id). The existing composite [employee_id, is_read] cannot serve a
--    pure is_read filter because employee_id leads it.
CREATE INDEX "notifications_is_read_idx" ON "notifications"("is_read");
