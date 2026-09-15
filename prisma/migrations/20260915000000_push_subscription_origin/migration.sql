-- Web Push: record WHICH SITE registered each browser.
--
-- Hand-written (migrate dev cannot create a shadow DB here - P3014), additive
-- only: one nullable column and one index. Nothing existing is altered.
--
-- THE BUG THIS FIXES. A push endpoint is a URL at the browser vendor
-- (fcm.googleapis.com), never at us, so a subscription row could not say which
-- origin created it. A dev server run against the production DATABASE_URL
-- therefore filed its localhost registration into this table beside the real
-- ones, and sendPushToEmployee() fans out to every row for that employee - so
-- one notification arrived twice, once labelled dnms.digitallynext.com and once
-- localhost:3000. It kept happening with the dev server stopped, because the
-- localhost service worker is still installed in the browser and wakes on push
-- without ever contacting localhost.
--
-- Left NULLABLE rather than backfilled: the origin of an existing row is
-- genuinely unknowable. The send path treats NULL as "not this origin", and the
-- browser re-registers on the next visit, so the legacy rows age out on their
-- own.

ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "origin" TEXT;

CREATE INDEX IF NOT EXISTS "push_subscriptions_employee_id_origin_idx"
  ON "push_subscriptions"("employee_id", "origin");
