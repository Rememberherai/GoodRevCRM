-- ============================================================================
-- Add messaging_profile_id to telnyx_connections for SMS support
-- ============================================================================

ALTER TABLE telnyx_connections
ADD COLUMN IF NOT EXISTS messaging_profile_id TEXT;

COMMENT ON COLUMN telnyx_connections.messaging_profile_id IS 'Telnyx Messaging Profile ID for SMS functionality';
