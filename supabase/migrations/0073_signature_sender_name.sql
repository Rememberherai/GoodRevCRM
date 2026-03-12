-- Add sender_name to email_signatures so From header shows a display name
ALTER TABLE email_signatures ADD COLUMN IF NOT EXISTS sender_name TEXT;
