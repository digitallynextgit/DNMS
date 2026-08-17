-- Company noticeboard: announcements + photo gallery.

CREATE TYPE "AnnouncementPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH');

CREATE TABLE "announcements" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priority" "AnnouncementPriority" NOT NULL DEFAULT 'NORMAL',
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "announcements_is_published_published_at_idx" ON "announcements"("is_published", "published_at");
CREATE INDEX "announcements_category_idx" ON "announcements"("category");
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "photo_albums" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "event_date" DATE,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "photo_albums_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "photo_albums_event_date_idx" ON "photo_albums"("event_date");
ALTER TABLE "photo_albums" ADD CONSTRAINT "photo_albums_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "photos" (
    "id" TEXT NOT NULL,
    "album_id" TEXT NOT NULL,
    "object_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "caption" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "uploaded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photos_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "photos_album_id_created_at_idx" ON "photos"("album_id", "created_at");
ALTER TABLE "photos" ADD CONSTRAINT "photos_album_id_fkey"
  FOREIGN KEY ("album_id") REFERENCES "photo_albums"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "photos" ADD CONSTRAINT "photos_uploaded_by_id_fkey"
  FOREIGN KEY ("uploaded_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
