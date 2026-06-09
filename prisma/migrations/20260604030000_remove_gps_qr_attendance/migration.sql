-- Remove the GPS Check-In and QR Kiosk attendance modes completely.
DROP TABLE IF EXISTS "gps_check_ins";
DROP TABLE IF EXISTS "qr_sessions";

-- Geofence columns were only used by GPS check-in.
ALTER TABLE "attendance_policies" DROP COLUMN IF EXISTS "office_latitude";
ALTER TABLE "attendance_policies" DROP COLUMN IF EXISTS "office_longitude";
ALTER TABLE "attendance_policies" DROP COLUMN IF EXISTS "geo_fence_radius";
