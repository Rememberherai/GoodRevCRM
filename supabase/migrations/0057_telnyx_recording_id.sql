-- Add telnyx_recording_id column to calls table
-- This stores the Telnyx recording ID so we can fetch fresh pre-signed
-- download URLs when streaming recordings to the browser.
ALTER TABLE calls ADD COLUMN IF NOT EXISTS telnyx_recording_id text;
