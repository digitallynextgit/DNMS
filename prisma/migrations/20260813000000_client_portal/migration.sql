-- Client portal + marketplace product catalog.
--
-- Client accounts live in their OWN table rather than in `employees`: every
-- existing HR/payroll/attendance query assumes a row in `employees` is staff,
-- so putting an external client there would mean auditing all of them. A
-- separate table makes leaking staff data to a client structurally impossible.
--
-- Visibility is DENY BY DEFAULT: a client sees a project only when a row exists
-- in client_project_access, and sees only the modules named by that row's
-- package. Two client users on the same project can hold different packages.

CREATE TYPE "ClientAccessStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

CREATE TYPE "MarketplaceProvider" AS ENUM (
  'SHOPIFY', 'AMAZON', 'FLIPKART', 'MEESHO', 'MYNTRA', 'WOOCOMMERCE', 'OTHER'
);

-- ---------------------------------------------------------------------------
-- Client accounts
-- ---------------------------------------------------------------------------
CREATE TABLE "client_users" (
  "id"                   TEXT NOT NULL,
  "email"                TEXT NOT NULL,
  "name"                 TEXT NOT NULL,
  "phone"                TEXT,
  "company"              TEXT,
  "password_hash"        TEXT,
  "must_change_password" BOOLEAN NOT NULL DEFAULT true,
  "is_active"            BOOLEAN NOT NULL DEFAULT true,
  "last_login_at"        TIMESTAMP(3),
  "created_by_id"        TEXT,
  "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"           TIMESTAMP(3) NOT NULL,

  CONSTRAINT "client_users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "client_users_email_key" ON "client_users"("email");
CREATE INDEX "client_users_is_active_idx" ON "client_users"("is_active");

ALTER TABLE "client_users"
  ADD CONSTRAINT "client_users_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Packages: a named bundle of portal module keys
-- ---------------------------------------------------------------------------
CREATE TABLE "client_packages" (
  "id"          TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "code"        TEXT NOT NULL,
  "description" TEXT,
  "modules"     TEXT[],
  "is_active"   BOOLEAN NOT NULL DEFAULT true,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL,

  CONSTRAINT "client_packages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "client_packages_name_key" ON "client_packages"("name");
CREATE UNIQUE INDEX "client_packages_code_key" ON "client_packages"("code");

-- ---------------------------------------------------------------------------
-- The grant: one row per (client user, project)
-- ---------------------------------------------------------------------------
CREATE TABLE "client_project_access" (
  "id"             TEXT NOT NULL,
  "client_user_id" TEXT NOT NULL,
  "project_id"     TEXT NOT NULL,
  "package_id"     TEXT NOT NULL,
  "status"         "ClientAccessStatus" NOT NULL DEFAULT 'ACTIVE',
  "granted_by_id"  TEXT,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL,

  CONSTRAINT "client_project_access_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "client_project_access_client_user_id_project_id_key"
  ON "client_project_access"("client_user_id", "project_id");
CREATE INDEX "client_project_access_project_id_idx" ON "client_project_access"("project_id");

ALTER TABLE "client_project_access"
  ADD CONSTRAINT "client_project_access_client_user_id_fkey"
  FOREIGN KEY ("client_user_id") REFERENCES "client_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_project_access"
  ADD CONSTRAINT "client_project_access_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_project_access"
  ADD CONSTRAINT "client_project_access_package_id_fkey"
  FOREIGN KEY ("package_id") REFERENCES "client_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "client_project_access"
  ADD CONSTRAINT "client_project_access_granted_by_id_fkey"
  FOREIGN KEY ("granted_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Marketplace channels (Shopify first; provider-agnostic by design)
-- ---------------------------------------------------------------------------
CREATE TABLE "marketplace_channels" (
  "id"              TEXT NOT NULL,
  "project_id"      TEXT NOT NULL,
  "provider"        "MarketplaceProvider" NOT NULL,
  "name"            TEXT NOT NULL,
  "external_id"     TEXT,
  "credentials"     TEXT,
  "status"          TEXT NOT NULL DEFAULT 'pending',
  "last_synced_at"  TIMESTAMP(3),
  "last_sync_error" TEXT,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "marketplace_channels_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "marketplace_channels_project_id_provider_name_key"
  ON "marketplace_channels"("project_id", "provider", "name");
CREATE INDEX "marketplace_channels_project_id_idx" ON "marketplace_channels"("project_id");

ALTER TABLE "marketplace_channels"
  ADD CONSTRAINT "marketplace_channels_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------------
CREATE TABLE "products" (
  "id"               TEXT NOT NULL,
  "project_id"       TEXT NOT NULL,
  "channel_id"       TEXT,
  "external_id"      TEXT,
  "title"            TEXT NOT NULL,
  "sku"              TEXT,
  "description"      TEXT,
  "image_url"        TEXT,
  "vendor"           TEXT,
  "category"         TEXT,
  "price"            DECIMAL(12,2),
  "compare_at_price" DECIMAL(12,2),
  "currency"         TEXT NOT NULL DEFAULT 'INR',
  "inventory_qty"    INTEGER,
  "status"           TEXT NOT NULL DEFAULT 'active',
  "tags"             TEXT[],
  "url"              TEXT,
  "last_synced_at"   TIMESTAMP(3),
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "products_channel_id_external_id_key" ON "products"("channel_id", "external_id");
CREATE INDEX "products_project_id_status_idx" ON "products"("project_id", "status");
CREATE INDEX "products_project_id_title_idx" ON "products"("project_id", "title");

ALTER TABLE "products"
  ADD CONSTRAINT "products_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "products"
  ADD CONSTRAINT "products_channel_id_fkey"
  FOREIGN KEY ("channel_id") REFERENCES "marketplace_channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Seed the three starter packages. Module keys must exist in the registry at
-- features/client-portal/modules.ts - unknown keys are ignored at read time, so
-- a typo here narrows access rather than widening it.
-- ---------------------------------------------------------------------------
INSERT INTO "client_packages" ("id", "name", "code", "description", "modules", "is_active", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'Catalog Only', 'catalog_only',
   'Product catalog for their own store - titles, images, pricing and stock.',
   ARRAY['products'], true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Marketplace', 'marketplace',
   'Product catalog plus per-channel breakdown across Shopify and other marketplaces.',
   ARRAY['products', 'channels'], true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Full Suite', 'full_suite',
   'Everything the portal can show today: catalog, channels and inventory health.',
   ARRAY['products', 'channels', 'inventory'], true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
