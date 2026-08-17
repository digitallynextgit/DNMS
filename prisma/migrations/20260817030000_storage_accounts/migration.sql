-- Multiple object-storage buckets.
CREATE TABLE "storage_accounts" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "key_id" TEXT NOT NULL,
    "app_key" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_verified_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "storage_accounts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "storage_accounts_is_default_idx" ON "storage_accounts"("is_default");
ALTER TABLE "storage_accounts" ADD CONSTRAINT "storage_accounts_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
