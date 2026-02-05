-- Add transcription column to calls table for storing call transcripts
ALTER TABLE calls ADD COLUMN IF NOT EXISTS transcription text;
