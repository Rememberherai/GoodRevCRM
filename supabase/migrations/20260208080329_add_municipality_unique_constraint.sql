-- Add unique constraint for municipality name, province, country combination
-- This allows upsert to work efficiently and prevents duplicates

ALTER TABLE municipalities
ADD CONSTRAINT IF NOT EXISTS municipalities_name_province_country_key
UNIQUE (name, province, country);
