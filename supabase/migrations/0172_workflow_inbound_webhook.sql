-- 0172_workflow_inbound_webhook.sql
-- Partial index for fast lookup of inbound-webhook workflows by secret token.
-- The token itself is stored (encrypted) inside the trigger_config JSONB column.

CREATE INDEX IF NOT EXISTS idx_workflows_inbound_webhook
  ON workflows(project_id, id)
  WHERE trigger_type = 'webhook_inbound' AND is_active = true;
