-- ============================================================================
-- Add call_control_app_id field to telnyx_connections
-- The Call Control API requires a Call Control Application ID (different from
-- the Credential SIP Connection ID used for WebRTC authentication)
-- ============================================================================

ALTER TABLE telnyx_connections
ADD COLUMN IF NOT EXISTS call_control_app_id text;

COMMENT ON COLUMN telnyx_connections.call_control_app_id IS 'Telnyx Call Control Application ID for initiating calls via the Call Control API';
