-- How much of a promised quantity has actually been made.
--
-- "4 blogs" is one row, but the work arrives one blog at a time. Without a
-- number for it, the only way to record the first blog was to declare the
-- whole row delivered, which is a lie for as long as three blogs are missing.
--
-- Additive with a default, so every existing row is valid the moment it lands.
ALTER TABLE "project_deliverables"
    ADD COLUMN "delivered_quantity" INTEGER NOT NULL DEFAULT 0;

-- Anything already made is fully made: without this back-fill every delivered
-- row in the app would suddenly read "0 of 4 done".
UPDATE "project_deliverables"
   SET "delivered_quantity" = "quantity"
 WHERE "status" IN ('DELIVERED', 'ACCEPTED');

-- Only the floor is enforced. A ceiling of `quantity` would be true today but
-- would block an ordinary correction tomorrow - editing "4 blogs" down to 2
-- after three were logged - so the service clamps instead, where it can
-- explain itself.
ALTER TABLE "project_deliverables"
    ADD CONSTRAINT "project_deliverables_delivered_quantity_check"
    CHECK ("delivered_quantity" >= 0);
