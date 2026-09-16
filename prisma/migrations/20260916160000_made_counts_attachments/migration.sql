-- Backfill: "Made" must not read 0 on a row with eight files attached.
--
-- ── THE BUG ──────────────────────────────────────────────────────────────────
-- delivered_quantity was only ever moved by staff logging delivery. Attaching a
-- file - which is the portal's whole way of handing work over - left it alone,
-- so a row could sit at "Made 0 of 8" next to eight uploaded posters. The count
-- and the evidence disagreed, and the evidence was right.
--
-- ── WHY GREATEST AND NOT A PLAIN RECOMPUTE ───────────────────────────────────
-- Setting delivered_quantity = (number of attachments) would have been simpler
-- and would have destroyed real data: 6 rows carry a staff-entered count with NO
-- attachments at all - work that was made and recorded but never uploaded. Those
-- are correct as they stand. So this only ever RAISES the count to match the
-- evidence, and never lowers one that is already running ahead of it.
--
-- Capped at quantity: "9 of 8 made" is not a thing, and a row that collected
-- more attachments than it planned for is still only as made as it was planned.

UPDATE "project_deliverables" d
SET "delivered_quantity" = LEAST(
        d."quantity",
        GREATEST(
            d."delivered_quantity",
            (
                SELECT count(*)
                FROM "project_resources" r
                WHERE r."deliverable_id" = d."id" AND r."is_client_visible" = true
            ) + coalesce(array_length(d."links", 1), 0)
        )
    )
WHERE d."delivered_quantity" < LEAST(
        d."quantity",
        (
            SELECT count(*)
            FROM "project_resources" r
            WHERE r."deliverable_id" = d."id" AND r."is_client_visible" = true
        ) + coalesce(array_length(d."links", 1), 0)
    );
