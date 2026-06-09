-- AlterTable
ALTER TABLE "attendance_policies" ADD COLUMN     "geo_fence_radius" INTEGER NOT NULL DEFAULT 200,
ADD COLUMN     "office_latitude" DOUBLE PRECISION,
ADD COLUMN     "office_longitude" DOUBLE PRECISION;
