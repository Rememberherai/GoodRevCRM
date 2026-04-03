-- Per-step send_as_reply override
-- NULL = inherit from sequence settings, true/false = explicit override
ALTER TABLE sequence_steps
  ADD COLUMN IF NOT EXISTS send_as_reply boolean DEFAULT NULL;

COMMENT ON COLUMN sequence_steps.send_as_reply IS
  'Per-step override for threading. NULL inherits from sequence settings.';
