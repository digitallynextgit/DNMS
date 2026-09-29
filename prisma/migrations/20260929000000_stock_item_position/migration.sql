-- Column order for the register matrix view: the register renders one column
-- per item, in the same order as the uploaded sheet. Backfill the initial
-- workbook's order (Given to | On date | Diary | Notepad | Pen | Bottle, with
-- Mug only in the catalogue); items imported later append after the max.
ALTER TABLE "stock_items" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

UPDATE "stock_items" SET "position" = 1 WHERE "name" = 'Diary';
UPDATE "stock_items" SET "position" = 2 WHERE "name" = 'Notepad';
UPDATE "stock_items" SET "position" = 3 WHERE "name" = 'Pen';
UPDATE "stock_items" SET "position" = 4 WHERE "name" = 'Bottle';
UPDATE "stock_items" SET "position" = 5 WHERE "name" = 'Mug';
