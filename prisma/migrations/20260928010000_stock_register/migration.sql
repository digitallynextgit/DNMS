-- HRMS stock register: a catalogue of purchased items and an issuance ledger.
-- holder_name is free text (sheets name non-employees); employee_id is the
-- optional link, SET NULL on employee deletion so the register row survives.
-- "Stock left" is computed (purchased - issued), never stored.
CREATE TABLE "stock_items" (
    "tenant_id" TEXT NOT NULL DEFAULT '0197d1ab-0000-7000-8000-000000000001',
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price_per_piece" DECIMAL(12,2),
    "purchased_qty" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stock_issues" (
    "tenant_id" TEXT NOT NULL DEFAULT '0197d1ab-0000-7000-8000-000000000001',
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "holder_name" TEXT NOT NULL,
    "employee_id" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "issued_on" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_issues_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stock_items_tenant_id_name_key" ON "stock_items"("tenant_id", "name");
CREATE INDEX "stock_issues_tenant_id_idx" ON "stock_issues"("tenant_id");
CREATE INDEX "stock_issues_item_id_idx" ON "stock_issues"("item_id");
CREATE INDEX "stock_issues_employee_id_idx" ON "stock_issues"("employee_id");
CREATE INDEX "stock_issues_tenant_id_holder_name_idx" ON "stock_issues"("tenant_id", "holder_name");

ALTER TABLE "stock_issues" ADD CONSTRAINT "stock_issues_item_id_fkey"
    FOREIGN KEY ("item_id") REFERENCES "stock_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_issues" ADD CONSTRAINT "stock_issues_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
