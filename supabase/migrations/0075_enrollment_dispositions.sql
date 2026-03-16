-- Add disposition statuses to sequence enrollments
-- These allow users to stop an enrollment with a reason instead of just deleting it

-- Drop and recreate the CHECK constraint to add new statuses
ALTER TABLE sequence_enrollments DROP CONSTRAINT IF EXISTS sequence_enrollments_status_check;
ALTER TABLE sequence_enrollments ADD CONSTRAINT sequence_enrollments_status_check
  CHECK (status IN (
    'active', 'paused', 'completed', 'bounced', 'replied', 'unsubscribed',
    'cancelled', 'not_interested', 'wrong_contact', 'do_not_contact'
  ));

-- Add disposition metadata
ALTER TABLE sequence_enrollments ADD COLUMN IF NOT EXISTS disposition_reason TEXT;
ALTER TABLE sequence_enrollments ADD COLUMN IF NOT EXISTS dispositioned_at TIMESTAMPTZ;
ALTER TABLE sequence_enrollments ADD COLUMN IF NOT EXISTS dispositioned_by UUID REFERENCES users(id);
