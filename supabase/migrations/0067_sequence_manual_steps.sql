-- ============================================================================
-- Add manual action step types to sequences (call, task, linkedin)
-- ============================================================================

-- Expand step_type CHECK constraint to include new manual action types
ALTER TABLE sequence_steps DROP CONSTRAINT IF EXISTS sequence_steps_step_type_check;
ALTER TABLE sequence_steps ADD CONSTRAINT sequence_steps_step_type_check
  CHECK (step_type IN ('email', 'delay', 'condition', 'sms', 'call', 'task', 'linkedin'));

-- Add config JSONB column for step-type-specific configuration
-- Used by call, task, and linkedin steps to store their configuration
ALTER TABLE sequence_steps ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}';

-- Add index on step_type for efficient filtering by type
CREATE INDEX IF NOT EXISTS idx_sequence_steps_type ON sequence_steps(step_type);
