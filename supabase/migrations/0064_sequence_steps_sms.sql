-- ============================================================================
-- Add SMS support to sequence_steps table
-- ============================================================================

-- Drop and recreate the step_type CHECK constraint to include 'sms'
ALTER TABLE sequence_steps
DROP CONSTRAINT IF EXISTS sequence_steps_step_type_check;

ALTER TABLE sequence_steps
ADD CONSTRAINT sequence_steps_step_type_check
CHECK (step_type IN ('email', 'delay', 'condition', 'sms'));

-- Add SMS-specific field
ALTER TABLE sequence_steps ADD COLUMN IF NOT EXISTS sms_body TEXT;
