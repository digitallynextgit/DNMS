-- Shopify sales for a project's marketplace channel: one row per order plus its line items.
-- Additive; hand-written, apply with `npx prisma migrate deploy`.

CREATE TABLE IF NOT EXISTS "shopify_orders" (
    "tenant_id"          TEXT NOT NULL DEFAULT '0197d1ab-0000-7000-8000-000000000001',
    "id"                 TEXT NOT NULL,
    "project_id"         TEXT NOT NULL,
    "channel_id"         TEXT NOT NULL,
    "order_id"           TEXT NOT NULL,
    "placed_at"          TIMESTAMP(3) NOT NULL,
    "date"               DATE NOT NULL,
    "financial_status"   TEXT NOT NULL,
    "fulfillment_status" TEXT,
    "cancelled"          BOOLEAN NOT NULL DEFAULT false,
    "counted"            BOOLEAN NOT NULL DEFAULT true,
    "sales_channel"      TEXT NOT NULL,
    "referrer"           TEXT NOT NULL,
    "state"              TEXT,
    "returning_customer" BOOLEAN,
    "gross_sales"        DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discounts"          DECIMAL(14,2) NOT NULL DEFAULT 0,
    "returns"            DECIMAL(14,2) NOT NULL DEFAULT 0,
    "net_sales"          DECIMAL(14,2) NOT NULL DEFAULT 0,
    "shipping"           DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxes"              DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_sales"        DECIMAL(14,2) NOT NULL DEFAULT 0,
    "units_sold"         INTEGER NOT NULL DEFAULT 0,
    "currency"           TEXT NOT NULL DEFAULT 'INR',
    "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"         TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shopify_orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "shopify_orders_channel_id_order_id_key" ON "shopify_orders"("channel_id", "order_id");
CREATE INDEX IF NOT EXISTS "shopify_orders_project_id_date_idx" ON "shopify_orders"("project_id", "date");
CREATE INDEX IF NOT EXISTS "shopify_orders_tenant_id_idx" ON "shopify_orders"("tenant_id");

ALTER TABLE "shopify_orders"
    ADD CONSTRAINT "shopify_orders_channel_id_fkey"
    FOREIGN KEY ("channel_id") REFERENCES "marketplace_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "shopify_order_lines" (
    "tenant_id"     TEXT NOT NULL DEFAULT '0197d1ab-0000-7000-8000-000000000001',
    "id"            TEXT NOT NULL,
    "order_id"      TEXT NOT NULL,
    "variant_id"    TEXT,
    "product_id"    TEXT,
    "title"         TEXT NOT NULL,
    "variant_title" TEXT,
    "sku"           TEXT,
    "quantity"      INTEGER NOT NULL DEFAULT 0,
    "revenue"       DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "shopify_order_lines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "shopify_order_lines_order_id_idx" ON "shopify_order_lines"("order_id");
CREATE INDEX IF NOT EXISTS "shopify_order_lines_tenant_id_idx" ON "shopify_order_lines"("tenant_id");

ALTER TABLE "shopify_order_lines"
    ADD CONSTRAINT "shopify_order_lines_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "shopify_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
