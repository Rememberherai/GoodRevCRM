-- Add recording_url to events and event_series for post-event replay links
ALTER TABLE events ADD COLUMN IF NOT EXISTS recording_url text;
ALTER TABLE event_series ADD COLUMN IF NOT EXISTS recording_url text;
