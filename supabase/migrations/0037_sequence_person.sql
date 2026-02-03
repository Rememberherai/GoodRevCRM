-- Add person_id to sequences for person-specific sequences
ALTER TABLE sequences
ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES people(id) ON DELETE SET NULL;

-- Index for filtering sequences by person
CREATE INDEX IF NOT EXISTS idx_sequences_person ON sequences(person_id)
WHERE person_id IS NOT NULL;

-- Add a comment explaining the feature
COMMENT ON COLUMN sequences.person_id IS 'Optional: links sequence to a specific person. When set, the sequence is person-specific and will appear on that person detail page.';
