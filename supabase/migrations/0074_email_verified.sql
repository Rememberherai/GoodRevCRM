-- Add email validation tracking columns to people table
ALTER TABLE people ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE people ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
