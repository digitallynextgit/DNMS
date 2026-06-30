-- Floating-holiday approval workflow: add manager/HR approval routing fields.
ALTER TABLE floating_holiday_selections ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE floating_holiday_selections ADD COLUMN IF NOT EXISTS manager_approver_id TEXT;
ALTER TABLE floating_holiday_selections ADD COLUMN IF NOT EXISTS manager_approved_at TIMESTAMP(3);
ALTER TABLE floating_holiday_selections ADD COLUMN IF NOT EXISTS hr_approver_id TEXT;
ALTER TABLE floating_holiday_selections ADD COLUMN IF NOT EXISTS hr_approved_at TIMESTAMP(3);
ALTER TABLE floating_holiday_selections ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE floating_holiday_selections ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP(3);
ALTER TABLE floating_holiday_selections ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP(3) NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS floating_holiday_selections_status_idx ON floating_holiday_selections(status);
