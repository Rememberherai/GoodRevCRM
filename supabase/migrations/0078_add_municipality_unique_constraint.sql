-- Add unique constraint for municipality name, province, country combination
-- This allows upsert to work efficiently and prevents duplicates

-- First, remove duplicates keeping the oldest record (by id)
DELETE FROM municipalities a
USING municipalities b
WHERE a.name = b.name
  AND a.province = b.province
  AND a.country = b.country
  AND a.id > b.id;

-- Now add the unique constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'municipalities_name_province_country_key'
  ) THEN
    ALTER TABLE municipalities
    ADD CONSTRAINT municipalities_name_province_country_key
    UNIQUE (name, province, country);
  END IF;
END $$;
