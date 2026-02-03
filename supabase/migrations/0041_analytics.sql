-- ============================================================================
-- Analytics: AI Usage Tracking + Dashboard RPC Functions
-- ============================================================================

-- ============================================================================
-- PART 1: AI Usage Log Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  feature TEXT NOT NULL CHECK (feature IN (
    'research', 'sequence_generation', 'contact_discovery',
    'rfp_response', 'content_extraction', 'bulk_rfp_generation'
  )),
  model TEXT NOT NULL,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_project ON ai_usage_log(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_user ON ai_usage_log(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_feature ON ai_usage_log(feature);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_created ON ai_usage_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_project_date ON ai_usage_log(project_id, created_at);

-- RLS
ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view AI usage in their projects"
  ON ai_usage_log FOR SELECT
  USING (
    project_id IN (
      SELECT project_id FROM project_memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert AI usage in their projects"
  ON ai_usage_log FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT project_id FROM project_memberships WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- PART 2: Analytics RPC Functions
-- ============================================================================

-- Activity tile metrics (calls, emails, quality convos, meetings booked/attended)
CREATE OR REPLACE FUNCTION get_activity_tile_metrics(
  p_project_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_end_date TIMESTAMPTZ DEFAULT NOW(),
  p_user_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_calls BIGINT := 0;
  v_emails BIGINT := 0;
  v_quality_convos BIGINT := 0;
  v_meetings_booked BIGINT := 0;
  v_meetings_attended BIGINT := 0;
BEGIN
  -- Calls from activity_log
  SELECT COUNT(*) INTO v_calls
  FROM activity_log
  WHERE project_id = p_project_id
    AND activity_type = 'call'
    AND created_at BETWEEN p_start_date AND p_end_date
    AND (p_user_id IS NULL OR user_id = p_user_id);

  -- Emails sent
  SELECT COUNT(*) INTO v_emails
  FROM sent_emails
  WHERE project_id = p_project_id
    AND sent_at BETWEEN p_start_date AND p_end_date
    AND (p_user_id IS NULL OR created_by = p_user_id);

  -- Quality conversations
  SELECT COUNT(*) INTO v_quality_convos
  FROM activity_log
  WHERE project_id = p_project_id
    AND outcome = 'quality_conversation'
    AND created_at BETWEEN p_start_date AND p_end_date
    AND (p_user_id IS NULL OR user_id = p_user_id);

  -- Meetings booked
  SELECT COUNT(*) INTO v_meetings_booked
  FROM meetings
  WHERE project_id = p_project_id
    AND created_at BETWEEN p_start_date AND p_end_date
    AND (p_user_id IS NULL OR created_by = p_user_id);

  -- Meetings attended
  SELECT COUNT(*) INTO v_meetings_attended
  FROM meetings
  WHERE project_id = p_project_id
    AND status = 'attended'
    AND scheduled_at BETWEEN p_start_date AND p_end_date
    AND (p_user_id IS NULL OR assigned_to = p_user_id);

  RETURN json_build_object(
    'calls', v_calls,
    'emails_sent', v_emails,
    'quality_conversations', v_quality_convos,
    'meetings_booked', v_meetings_booked,
    'meetings_attended', v_meetings_attended
  );
END;
$$;

-- Opportunity funnel by stage
CREATE OR REPLACE FUNCTION get_opportunity_funnel(
  p_project_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  stage TEXT,
  count BIGINT,
  total_value NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.stage::TEXT,
    COUNT(*)::BIGINT,
    COALESCE(SUM(o.amount), 0)::NUMERIC
  FROM opportunities o
  WHERE o.project_id = p_project_id
    AND o.deleted_at IS NULL
    AND (p_start_date IS NULL OR o.created_at >= p_start_date)
    AND (p_end_date IS NULL OR o.created_at <= p_end_date)
    AND (p_user_id IS NULL OR o.owner_id = p_user_id)
  GROUP BY o.stage
  ORDER BY
    CASE o.stage
      WHEN 'prospecting' THEN 1
      WHEN 'qualification' THEN 2
      WHEN 'proposal' THEN 3
      WHEN 'negotiation' THEN 4
      WHEN 'closed_won' THEN 5
      WHEN 'closed_lost' THEN 6
    END;
END;
$$;

-- RFP funnel by status
CREATE OR REPLACE FUNCTION get_rfp_funnel(
  p_project_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  status TEXT,
  count BIGINT,
  total_value NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.status::TEXT,
    COUNT(*)::BIGINT,
    COALESCE(SUM(r.estimated_value), 0)::NUMERIC
  FROM rfps r
  WHERE r.project_id = p_project_id
    AND r.deleted_at IS NULL
    AND (p_start_date IS NULL OR r.created_at >= p_start_date)
    AND (p_end_date IS NULL OR r.created_at <= p_end_date)
    AND (p_user_id IS NULL OR r.owner_id = p_user_id)
  GROUP BY r.status
  ORDER BY
    CASE r.status
      WHEN 'identified' THEN 1
      WHEN 'reviewing' THEN 2
      WHEN 'preparing' THEN 3
      WHEN 'submitted' THEN 4
      WHEN 'won' THEN 5
      WHEN 'lost' THEN 6
      WHEN 'no_bid' THEN 7
    END;
END;
$$;

-- AI usage stats
CREATE OR REPLACE FUNCTION get_ai_usage_stats(
  p_project_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_end_date TIMESTAMPTZ DEFAULT NOW(),
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  feature TEXT,
  model TEXT,
  total_tokens BIGINT,
  prompt_tokens BIGINT,
  completion_tokens BIGINT,
  call_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.feature::TEXT,
    a.model::TEXT,
    COALESCE(SUM(a.total_tokens), 0)::BIGINT,
    COALESCE(SUM(a.prompt_tokens), 0)::BIGINT,
    COALESCE(SUM(a.completion_tokens), 0)::BIGINT,
    COUNT(*)::BIGINT
  FROM ai_usage_log a
  WHERE a.project_id = p_project_id
    AND a.created_at BETWEEN p_start_date AND p_end_date
    AND (p_user_id IS NULL OR a.user_id = p_user_id)
  GROUP BY a.feature, a.model
  ORDER BY SUM(a.total_tokens) DESC NULLS LAST;
END;
$$;

-- Enrichment stats
CREATE OR REPLACE FUNCTION get_enrichment_stats(
  p_project_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_end_date TIMESTAMPTZ DEFAULT NOW(),
  p_user_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_credits BIGINT;
  v_job_count BIGINT;
  v_completed BIGINT;
  v_failed BIGINT;
BEGIN
  SELECT
    COALESCE(SUM(credits_used), 0),
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'completed'),
    COUNT(*) FILTER (WHERE status = 'failed')
  INTO v_total_credits, v_job_count, v_completed, v_failed
  FROM enrichment_jobs
  WHERE project_id = p_project_id
    AND created_at BETWEEN p_start_date AND p_end_date
    AND (p_user_id IS NULL OR created_by = p_user_id);

  RETURN json_build_object(
    'total_credits', v_total_credits,
    'job_count', v_job_count,
    'completed_count', v_completed,
    'failed_count', v_failed,
    'success_rate', CASE WHEN v_job_count > 0
      THEN ROUND(v_completed::NUMERIC / v_job_count * 100, 1)
      ELSE 0
    END
  );
END;
$$;

-- Email performance
CREATE OR REPLACE FUNCTION get_email_performance(
  p_project_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_end_date TIMESTAMPTZ DEFAULT NOW(),
  p_user_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_sent BIGINT;
  v_total_opens BIGINT;
  v_unique_opens BIGINT;
  v_total_clicks BIGINT;
  v_total_replies BIGINT;
  v_total_bounces BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_total_sent
  FROM sent_emails
  WHERE project_id = p_project_id
    AND sent_at BETWEEN p_start_date AND p_end_date
    AND (p_user_id IS NULL OR created_by = p_user_id);

  SELECT
    COUNT(*) FILTER (WHERE ee.event_type = 'open'),
    COUNT(DISTINCT CASE WHEN ee.event_type = 'open' THEN se.id END),
    COUNT(*) FILTER (WHERE ee.event_type = 'click'),
    COUNT(*) FILTER (WHERE ee.event_type = 'reply'),
    COUNT(*) FILTER (WHERE ee.event_type = 'bounce')
  INTO v_total_opens, v_unique_opens, v_total_clicks, v_total_replies, v_total_bounces
  FROM sent_emails se
  JOIN email_events ee ON se.id = ee.sent_email_id
  WHERE se.project_id = p_project_id
    AND se.sent_at BETWEEN p_start_date AND p_end_date
    AND (p_user_id IS NULL OR se.created_by = p_user_id);

  RETURN json_build_object(
    'total_sent', v_total_sent,
    'total_opens', COALESCE(v_total_opens, 0),
    'unique_opens', COALESCE(v_unique_opens, 0),
    'total_clicks', COALESCE(v_total_clicks, 0),
    'total_replies', COALESCE(v_total_replies, 0),
    'total_bounces', COALESCE(v_total_bounces, 0),
    'open_rate', CASE WHEN v_total_sent > 0
      THEN ROUND(COALESCE(v_unique_opens, 0)::NUMERIC / v_total_sent * 100, 1)
      ELSE 0
    END,
    'click_rate', CASE WHEN v_total_sent > 0
      THEN ROUND(COALESCE(v_total_clicks, 0)::NUMERIC / v_total_sent * 100, 1)
      ELSE 0
    END,
    'reply_rate', CASE WHEN v_total_sent > 0
      THEN ROUND(COALESCE(v_total_replies, 0)::NUMERIC / v_total_sent * 100, 1)
      ELSE 0
    END,
    'bounce_rate', CASE WHEN v_total_sent > 0
      THEN ROUND(COALESCE(v_total_bounces, 0)::NUMERIC / v_total_sent * 100, 1)
      ELSE 0
    END
  );
END;
$$;

-- ============================================================================
-- PART 3: Update existing reporting functions with user filter
-- ============================================================================

-- Update get_pipeline_summary to accept user filter
CREATE OR REPLACE FUNCTION get_pipeline_summary(
  p_project_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  stage_name TEXT,
  opportunity_count BIGINT,
  total_value NUMERIC,
  avg_value NUMERIC,
  weighted_value NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.stage::TEXT,
    COUNT(o.id)::BIGINT,
    COALESCE(SUM(o.amount), 0)::NUMERIC,
    COALESCE(AVG(o.amount), 0)::NUMERIC,
    COALESCE(SUM(o.amount * COALESCE(o.probability, 0) / 100), 0)::NUMERIC
  FROM opportunities o
  WHERE o.project_id = p_project_id
    AND o.deleted_at IS NULL
    AND o.stage NOT IN ('closed_won', 'closed_lost')
    AND (p_user_id IS NULL OR o.owner_id = p_user_id)
  GROUP BY o.stage
  ORDER BY o.stage;
END;
$$;

-- Update get_conversion_metrics with user filter
CREATE OR REPLACE FUNCTION get_conversion_metrics(
  p_project_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '12 months',
  p_end_date TIMESTAMPTZ DEFAULT NOW(),
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  month DATE,
  total_created BIGINT,
  won_count BIGINT,
  lost_count BIGINT,
  open_count BIGINT,
  won_value NUMERIC,
  lost_value NUMERIC,
  win_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE_TRUNC('month', o.created_at)::DATE,
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE o.stage = 'closed_won')::BIGINT,
    COUNT(*) FILTER (WHERE o.stage = 'closed_lost')::BIGINT,
    COUNT(*) FILTER (WHERE o.stage NOT IN ('closed_won', 'closed_lost'))::BIGINT,
    COALESCE(SUM(o.amount) FILTER (WHERE o.stage = 'closed_won'), 0)::NUMERIC,
    COALESCE(SUM(o.amount) FILTER (WHERE o.stage = 'closed_lost'), 0)::NUMERIC,
    ROUND(
      COUNT(*) FILTER (WHERE o.stage = 'closed_won')::NUMERIC /
      NULLIF(COUNT(*) FILTER (WHERE o.stage IN ('closed_won', 'closed_lost')), 0) * 100,
      2
    )
  FROM opportunities o
  WHERE o.project_id = p_project_id
    AND o.deleted_at IS NULL
    AND o.created_at BETWEEN p_start_date AND p_end_date
    AND (p_user_id IS NULL OR o.owner_id = p_user_id)
  GROUP BY DATE_TRUNC('month', o.created_at)
  ORDER BY DATE_TRUNC('month', o.created_at) DESC;
END;
$$;

-- Update get_revenue_metrics with user filter
CREATE OR REPLACE FUNCTION get_revenue_metrics(
  p_project_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '12 months',
  p_end_date TIMESTAMPTZ DEFAULT NOW(),
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  month DATE,
  closed_won_value NUMERIC,
  expected_value NUMERIC,
  opportunity_count BIGINT,
  avg_deal_size NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE_TRUNC('month', o.updated_at)::DATE,
    COALESCE(SUM(o.amount) FILTER (WHERE o.stage = 'closed_won'), 0)::NUMERIC,
    COALESCE(SUM(o.amount * COALESCE(o.probability, 0) / 100), 0)::NUMERIC,
    COUNT(*)::BIGINT,
    COALESCE(AVG(o.amount), 0)::NUMERIC
  FROM opportunities o
  WHERE o.project_id = p_project_id
    AND o.deleted_at IS NULL
    AND o.updated_at BETWEEN p_start_date AND p_end_date
    AND (p_user_id IS NULL OR o.owner_id = p_user_id)
  GROUP BY DATE_TRUNC('month', o.updated_at)
  ORDER BY DATE_TRUNC('month', o.updated_at) DESC;
END;
$$;

-- Update get_team_performance with user filter
CREATE OR REPLACE FUNCTION get_team_performance(
  p_project_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_end_date TIMESTAMPTZ DEFAULT NOW(),
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  user_id UUID,
  user_email VARCHAR,
  opportunities_created BIGINT,
  opportunities_won BIGINT,
  total_won_value NUMERIC,
  tasks_completed BIGINT,
  activities_logged BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.email::VARCHAR,
    COUNT(DISTINCT o.id) FILTER (WHERE o.created_at BETWEEN p_start_date AND p_end_date)::BIGINT,
    COUNT(DISTINCT o.id) FILTER (WHERE o.stage = 'closed_won' AND o.updated_at BETWEEN p_start_date AND p_end_date)::BIGINT,
    COALESCE(SUM(o.amount) FILTER (WHERE o.stage = 'closed_won' AND o.updated_at BETWEEN p_start_date AND p_end_date), 0)::NUMERIC,
    COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'completed' AND t.updated_at BETWEEN p_start_date AND p_end_date)::BIGINT,
    COUNT(DISTINCT al.id) FILTER (WHERE al.created_at BETWEEN p_start_date AND p_end_date)::BIGINT
  FROM users u
  JOIN project_memberships pm ON pm.user_id = u.id AND pm.project_id = p_project_id
  LEFT JOIN opportunities o ON o.owner_id = u.id AND o.project_id = p_project_id AND o.deleted_at IS NULL
  LEFT JOIN tasks t ON t.assignee_id = u.id AND t.project_id = p_project_id
  LEFT JOIN activity_log al ON al.user_id = u.id AND al.project_id = p_project_id
  WHERE (p_user_id IS NULL OR u.id = p_user_id)
  GROUP BY u.id, u.email
  ORDER BY COALESCE(SUM(o.amount) FILTER (WHERE o.stage = 'closed_won' AND o.updated_at BETWEEN p_start_date AND p_end_date), 0) DESC;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_activity_tile_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION get_opportunity_funnel TO authenticated;
GRANT EXECUTE ON FUNCTION get_rfp_funnel TO authenticated;
GRANT EXECUTE ON FUNCTION get_ai_usage_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_enrichment_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_email_performance TO authenticated;
