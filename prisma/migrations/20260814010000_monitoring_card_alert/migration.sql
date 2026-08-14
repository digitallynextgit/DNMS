-- Track the payment-card warning separately from the renewal warning.
--
-- The renewal sweep moved off cron onto the in-process scheduler, which ticks
-- far more often than daily. Per-asset "when did I last say this" timestamps are
-- what make that safe: without a separate one for the card, a card warning and a
-- renewal warning would suppress each other and only one of the two would ever
-- be sent.

ALTER TABLE "project_assets" ADD COLUMN "last_card_alert_at" TIMESTAMP(3);
