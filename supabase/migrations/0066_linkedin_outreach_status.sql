-- Add linkedin_outreach_status column to people table
-- Tracks LinkedIn connection status for manual outreach workflow

ALTER TABLE people ADD COLUMN IF NOT EXISTS linkedin_outreach_status TEXT;

-- Add check constraint for valid statuses
ALTER TABLE people ADD CONSTRAINT people_linkedin_outreach_status_check
  CHECK (linkedin_outreach_status IS NULL OR linkedin_outreach_status IN (
    'pending',
    'connection_sent',
    'connected',
    'not_interested'
  ));

-- Index for filtering by LinkedIn status
CREATE INDEX IF NOT EXISTS idx_people_linkedin_outreach_status
  ON people(project_id, linkedin_outreach_status)
  WHERE linkedin_outreach_status IS NOT NULL;
