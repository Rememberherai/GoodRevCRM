-- Email events table for tracking opens, clicks, etc.
CREATE TABLE email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_email_id UUID NOT NULL REFERENCES sent_emails(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('open', 'click', 'bounce', 'reply')),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Event metadata
  metadata JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  link_url TEXT
);

-- Indexes for fast lookups
CREATE INDEX idx_email_events_sent_email ON email_events(sent_email_id);
CREATE INDEX idx_email_events_type ON email_events(event_type);
CREATE INDEX idx_email_events_occurred_at ON email_events(occurred_at DESC);

-- Composite index for analytics
CREATE INDEX idx_email_events_analytics ON email_events(sent_email_id, event_type, occurred_at);

-- Enable RLS
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;

-- RLS policies - events inherit visibility from sent_emails
CREATE POLICY "Users can view email events for their projects"
  ON email_events FOR SELECT
  USING (
    sent_email_id IN (
      SELECT id FROM sent_emails WHERE project_id IN (
        SELECT project_id FROM project_memberships WHERE user_id = auth.uid()
      )
    )
  );

-- Service role can insert events (for tracking endpoints)
CREATE POLICY "Service role can insert email events"
  ON email_events FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Also allow authenticated users to insert (for webhook handlers)
CREATE POLICY "Authenticated users can insert email events"
  ON email_events FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Create view for email stats
CREATE OR REPLACE VIEW email_tracking_stats AS
SELECT
  se.id AS sent_email_id,
  se.project_id,
  se.person_id,
  se.organization_id,
  se.opportunity_id,
  se.rfp_id,
  COUNT(*) FILTER (WHERE ee.event_type = 'open') AS opens,
  COUNT(DISTINCT CASE WHEN ee.event_type = 'open' THEN ee.ip_address END) AS unique_opens,
  COUNT(*) FILTER (WHERE ee.event_type = 'click') AS clicks,
  COUNT(DISTINCT CASE WHEN ee.event_type = 'click' THEN ee.ip_address END) AS unique_clicks,
  COUNT(*) FILTER (WHERE ee.event_type = 'reply') AS replies,
  COUNT(*) FILTER (WHERE ee.event_type = 'bounce') AS bounces,
  MIN(ee.occurred_at) FILTER (WHERE ee.event_type = 'open') AS first_open_at,
  MAX(ee.occurred_at) FILTER (WHERE ee.event_type = 'open') AS last_open_at
FROM sent_emails se
LEFT JOIN email_events ee ON se.id = ee.sent_email_id
GROUP BY se.id, se.project_id, se.person_id, se.organization_id, se.opportunity_id, se.rfp_id;
