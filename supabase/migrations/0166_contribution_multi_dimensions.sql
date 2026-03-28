-- Allow contributions to have multiple dimensions (checkbox multi-select)
-- Adds dimension_ids text[] array column, migrates existing dimension_id data, then drops the old column.

-- Step 1: Add the new array column
ALTER TABLE contributions ADD COLUMN IF NOT EXISTS dimension_ids text[] NOT NULL DEFAULT '{}';

-- Step 2: Migrate existing single dimension_id values into the array
UPDATE contributions
SET dimension_ids = ARRAY[dimension_id::text]
WHERE dimension_id IS NOT NULL;

-- Step 3: Drop the old foreign key constraint and column
ALTER TABLE contributions DROP CONSTRAINT IF EXISTS contributions_dimension_id_fkey;
ALTER TABLE contributions DROP COLUMN IF EXISTS dimension_id;
