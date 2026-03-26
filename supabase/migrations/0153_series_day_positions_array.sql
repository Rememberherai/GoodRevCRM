-- Change recurrence_day_position from single INTEGER to INTEGER[] array
-- to support patterns like "1st and 3rd Monday" (multiple day positions).
-- Also add generation_status column for async instance generation tracking.

-- Step 1: Convert recurrence_day_position from INTEGER to INTEGER[]
ALTER TABLE event_series
  ADD COLUMN IF NOT EXISTS recurrence_day_positions INTEGER[];

-- Migrate existing single values into the array column
UPDATE event_series
SET recurrence_day_positions = ARRAY[recurrence_day_position]
WHERE recurrence_day_position IS NOT NULL
  AND recurrence_day_positions IS NULL;

-- Drop the old column
ALTER TABLE event_series DROP COLUMN IF EXISTS recurrence_day_position;

-- Rename new column to match the old name for minimal code changes
-- Actually, keep it as recurrence_day_positions (plural) since it's an array now

-- Step 2: Add generation tracking columns
ALTER TABLE event_series
  ADD COLUMN IF NOT EXISTS generation_status TEXT NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS generation_progress INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS generation_total INTEGER DEFAULT 0;
