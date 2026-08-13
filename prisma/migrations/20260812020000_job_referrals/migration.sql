-- Job referrals.
--
-- A candidate can name the employee who referred them (the careers site asks for
-- an employee id), or an employee can raise the referral directly inside DNMS.
-- Either way it is the SAME career_applications row, so one pipeline serves both
-- and HR never has two lists to reconcile.
--
-- referrer_employee_no keeps what was typed even when it matches nobody: a typo
-- must never cost a real application, and HR can still see the intent and fix
-- the link by hand.
--
-- The reward clock starts at hired_employee_id: once HR links a hired applicant
-- to the employee record created for them, the one-year anniversary is derivable
-- from that employee's date_of_joining. reward_amount is frozen at payout
-- because the referred employee's salary can move afterwards, and what was
-- actually paid must not move with it.

ALTER TABLE "career_applications"
    ADD COLUMN "referrer_employee_no"  TEXT,
    ADD COLUMN "referrer_id"           TEXT,
    ADD COLUMN "hired_employee_id"     TEXT,
    ADD COLUMN "reward_amount"         DECIMAL(12,2),
    ADD COLUMN "reward_paid_at"        TIMESTAMP(3),
    ADD COLUMN "reward_notified_at"    TIMESTAMP(3),
    ADD COLUMN "is_internal_referral"  BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "career_applications_referrer_id_idx" ON "career_applications"("referrer_id");
CREATE INDEX "career_applications_hired_employee_id_idx" ON "career_applications"("hired_employee_id");

-- SetNull on both: losing an employee record must never delete the application
-- or the reward history attached to it.
ALTER TABLE "career_applications"
    ADD CONSTRAINT "career_applications_referrer_id_fkey"
    FOREIGN KEY ("referrer_id") REFERENCES "employees"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "career_applications"
    ADD CONSTRAINT "career_applications_hired_employee_id_fkey"
    FOREIGN KEY ("hired_employee_id") REFERENCES "employees"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
