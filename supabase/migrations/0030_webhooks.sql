-- Migration: 0030_webhooks.sql
-- Description: Webhooks for external integrations

-- Webhooks table
CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  secret VARCHAR(255),
  events TEXT[] NOT NULL DEFAULT '{}',
  headers JSONB DEFAULT '{}'::JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  retry_count INTEGER NOT NULL DEFAULT 3,
  timeout_ms INTEGER NOT NULL DEFAULT 30000,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Webhook deliveries table (log of webhook calls)
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  request_headers JSONB,
  response_status INTEGER,
  response_body TEXT,
  response_headers JSONB,
  duration_ms INTEGER,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  error_message TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for webhooks
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view webhooks in their projects"
  ON webhooks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_memberships
      WHERE project_memberships.project_id = webhooks.project_id
        AND project_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage webhooks"
  ON webhooks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM project_memberships
      WHERE project_memberships.project_id = webhooks.project_id
        AND project_memberships.user_id = auth.uid()
        AND project_memberships.role IN ('owner', 'admin')
    )
  );

-- RLS for webhook_deliveries
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view webhook deliveries in their projects"
  ON webhook_deliveries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM webhooks
      JOIN project_memberships ON project_memberships.project_id = webhooks.project_id
      WHERE webhooks.id = webhook_deliveries.webhook_id
        AND project_memberships.user_id = auth.uid()
    )
  );

-- Function to queue webhook delivery
CREATE OR REPLACE FUNCTION queue_webhook_delivery(
  p_webhook_id UUID,
  p_event_type VARCHAR(100),
  p_payload JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_delivery_id UUID;
BEGIN
  INSERT INTO webhook_deliveries (webhook_id, event_type, payload, status)
  VALUES (p_webhook_id, p_event_type, p_payload, 'pending')
  RETURNING id INTO v_delivery_id;

  RETURN v_delivery_id;
END;
$$;

-- Function to get webhooks for an event
CREATE OR REPLACE FUNCTION get_webhooks_for_event(
  p_project_id UUID,
  p_event_type VARCHAR(100)
)
RETURNS TABLE (
  id UUID,
  url TEXT,
  secret VARCHAR(255),
  headers JSONB,
  retry_count INTEGER,
  timeout_ms INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    w.id,
    w.url,
    w.secret,
    w.headers,
    w.retry_count,
    w.timeout_ms
  FROM webhooks w
  WHERE w.project_id = p_project_id
    AND w.is_active = true
    AND p_event_type = ANY(w.events);
END;
$$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_webhooks_project ON webhooks(project_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks(project_id, is_active);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created ON webhook_deliveries(created_at);

-- Update timestamp trigger
CREATE TRIGGER update_webhooks_updated_at
  BEFORE UPDATE ON webhooks
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
