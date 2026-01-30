-- Phase 22: Reporting
-- Analytics views and report functions for CRM metrics

-- ============================================================================
-- ANALYTICS VIEWS
-- ============================================================================

-- Pipeline summary view
CREATE OR REPLACE VIEW pipeline_summary AS
SELECT
  p.id AS project_id,
  ps.id AS stage_id,
  ps.name AS stage_name,
  ps.position AS stage_position,
  COUNT(o.id) AS opportunity_count,
  COALESCE(SUM(o.value), 0) AS total_value,
  COALESCE(AVG(o.value), 0) AS avg_value,
  COALESCE(AVG(o.probability), 0) AS avg_probability,
  COALESCE(SUM(o.value * o.probability / 100), 0) AS weighted_value
FROM projects p
CROSS JOIN pipeline_stages ps
LEFT JOIN opportunities o ON o.stage_id = ps.id
  AND o.project_id = p.id
  AND o.status = 'open'
WHERE ps.project_id = p.id AND ps.is_active = true
GROUP BY p.id, ps.id, ps.name, ps.position
ORDER BY ps.position;

-- Activity metrics view
CREATE OR REPLACE VIEW activity_metrics AS
SELECT
  project_id,
  DATE_TRUNC('day', created_at) AS activity_date,
  entity_type,
  action,
  COUNT(*) AS activity_count,
  COUNT(DISTINCT user_id) AS unique_users
FROM activity_logs
GROUP BY project_id, DATE_TRUNC('day', created_at), entity_type, action;

-- Opportunity conversion rates
CREATE OR REPLACE VIEW opportunity_conversion AS
SELECT
  project_id,
  DATE_TRUNC('month', created_at) AS month,
  COUNT(*) AS total_created,
  COUNT(*) FILTER (WHERE status = 'won') AS won_count,
  COUNT(*) FILTER (WHERE status = 'lost') AS lost_count,
  COUNT(*) FILTER (WHERE status = 'open') AS open_count,
  COALESCE(SUM(value) FILTER (WHERE status = 'won'), 0) AS won_value,
  COALESCE(SUM(value) FILTER (WHERE status = 'lost'), 0) AS lost_value,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'won')::numeric /
    NULLIF(COUNT(*) FILTER (WHERE status IN ('won', 'lost')), 0) * 100,
    2
  ) AS win_rate
FROM opportunities
GROUP BY project_id, DATE_TRUNC('month', created_at);

-- ============================================================================
-- REPORT DEFINITIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS report_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  report_type VARCHAR(50) NOT NULL CHECK (report_type IN (
    'pipeline', 'activity', 'conversion', 'revenue', 'team_performance', 'custom'
  )),
  config JSONB NOT NULL DEFAULT '{}',
  filters JSONB NOT NULL DEFAULT '{}',
  schedule VARCHAR(50) CHECK (schedule IN ('daily', 'weekly', 'monthly', 'quarterly', NULL)),
  last_run_at TIMESTAMPTZ,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Report runs/snapshots
CREATE TABLE IF NOT EXISTS report_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES report_definitions(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  result JSONB,
  error_message TEXT,
  run_duration_ms INTEGER,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dashboard widgets
CREATE TABLE IF NOT EXISTS dashboard_widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  widget_type VARCHAR(50) NOT NULL CHECK (widget_type IN (
    'pipeline_chart', 'activity_feed', 'conversion_rate', 'revenue_chart',
    'top_opportunities', 'recent_activities', 'task_summary', 'team_leaderboard'
  )),
  config JSONB NOT NULL DEFAULT '{}',
  position INTEGER NOT NULL DEFAULT 0,
  size VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (size IN ('small', 'medium', 'large', 'full')),
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, user_id, widget_type)
);

-- Indexes
CREATE INDEX idx_report_definitions_project ON report_definitions(project_id);
CREATE INDEX idx_report_definitions_type ON report_definitions(report_type);
CREATE INDEX idx_report_runs_report ON report_runs(report_id);
CREATE INDEX idx_report_runs_project ON report_runs(project_id);
CREATE INDEX idx_report_runs_status ON report_runs(status);
CREATE INDEX idx_dashboard_widgets_project_user ON dashboard_widgets(project_id, user_id);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE report_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_widgets ENABLE ROW LEVEL SECURITY;

-- Report definitions policies
CREATE POLICY "Users can view reports in their projects"
  ON report_definitions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = report_definitions.project_id
      AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage reports"
  ON report_definitions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = report_definitions.project_id
      AND pm.user_id = auth.uid()
      AND pm.role IN ('owner', 'admin')
    )
  );

-- Report runs policies
CREATE POLICY "Users can view report runs in their projects"
  ON report_runs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = report_runs.project_id
      AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage report runs"
  ON report_runs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = report_runs.project_id
      AND pm.user_id = auth.uid()
      AND pm.role IN ('owner', 'admin')
    )
  );

-- Dashboard widgets policies
CREATE POLICY "Users can manage their own widgets"
  ON dashboard_widgets FOR ALL
  USING (user_id = auth.uid());

-- ============================================================================
-- REPORTING FUNCTIONS
-- ============================================================================

-- Get pipeline summary for a project
CREATE OR REPLACE FUNCTION get_pipeline_summary(p_project_id UUID)
RETURNS TABLE (
  stage_id UUID,
  stage_name VARCHAR,
  stage_position INTEGER,
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
    ps.id,
    ps.name,
    ps.position,
    COUNT(o.id)::BIGINT,
    COALESCE(SUM(o.value), 0)::NUMERIC,
    COALESCE(AVG(o.value), 0)::NUMERIC,
    COALESCE(SUM(o.value * o.probability / 100), 0)::NUMERIC
  FROM pipeline_stages ps
  LEFT JOIN opportunities o ON o.stage_id = ps.id
    AND o.project_id = p_project_id
    AND o.status = 'open'
  WHERE ps.project_id = p_project_id AND ps.is_active = true
  GROUP BY ps.id, ps.name, ps.position
  ORDER BY ps.position;
END;
$$;

-- Get activity summary for a date range
CREATE OR REPLACE FUNCTION get_activity_summary(
  p_project_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  activity_date DATE,
  entity_type VARCHAR,
  action VARCHAR,
  count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(al.created_at),
    al.entity_type,
    al.action,
    COUNT(*)::BIGINT
  FROM activity_logs al
  WHERE al.project_id = p_project_id
    AND al.created_at BETWEEN p_start_date AND p_end_date
  GROUP BY DATE(al.created_at), al.entity_type, al.action
  ORDER BY DATE(al.created_at) DESC;
END;
$$;

-- Get conversion metrics
CREATE OR REPLACE FUNCTION get_conversion_metrics(
  p_project_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '12 months',
  p_end_date TIMESTAMPTZ DEFAULT NOW()
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
    COUNT(*) FILTER (WHERE o.status = 'won')::BIGINT,
    COUNT(*) FILTER (WHERE o.status = 'lost')::BIGINT,
    COUNT(*) FILTER (WHERE o.status = 'open')::BIGINT,
    COALESCE(SUM(o.value) FILTER (WHERE o.status = 'won'), 0)::NUMERIC,
    COALESCE(SUM(o.value) FILTER (WHERE o.status = 'lost'), 0)::NUMERIC,
    ROUND(
      COUNT(*) FILTER (WHERE o.status = 'won')::NUMERIC /
      NULLIF(COUNT(*) FILTER (WHERE o.status IN ('won', 'lost')), 0) * 100,
      2
    )
  FROM opportunities o
  WHERE o.project_id = p_project_id
    AND o.created_at BETWEEN p_start_date AND p_end_date
  GROUP BY DATE_TRUNC('month', o.created_at)
  ORDER BY DATE_TRUNC('month', o.created_at) DESC;
END;
$$;

-- Get revenue metrics
CREATE OR REPLACE FUNCTION get_revenue_metrics(
  p_project_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '12 months',
  p_end_date TIMESTAMPTZ DEFAULT NOW()
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
    COALESCE(SUM(o.value) FILTER (WHERE o.status = 'won'), 0)::NUMERIC,
    COALESCE(SUM(o.value * o.probability / 100), 0)::NUMERIC,
    COUNT(*)::BIGINT,
    COALESCE(AVG(o.value), 0)::NUMERIC
  FROM opportunities o
  WHERE o.project_id = p_project_id
    AND o.updated_at BETWEEN p_start_date AND p_end_date
  GROUP BY DATE_TRUNC('month', o.updated_at)
  ORDER BY DATE_TRUNC('month', o.updated_at) DESC;
END;
$$;

-- Get team performance metrics
CREATE OR REPLACE FUNCTION get_team_performance(
  p_project_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_end_date TIMESTAMPTZ DEFAULT NOW()
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
    COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'won' AND o.updated_at BETWEEN p_start_date AND p_end_date)::BIGINT,
    COALESCE(SUM(o.value) FILTER (WHERE o.status = 'won' AND o.updated_at BETWEEN p_start_date AND p_end_date), 0)::NUMERIC,
    COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'completed' AND t.updated_at BETWEEN p_start_date AND p_end_date)::BIGINT,
    COUNT(DISTINCT al.id) FILTER (WHERE al.created_at BETWEEN p_start_date AND p_end_date)::BIGINT
  FROM auth.users u
  JOIN project_memberships pm ON pm.user_id = u.id AND pm.project_id = p_project_id
  LEFT JOIN opportunities o ON o.owner_id = u.id AND o.project_id = p_project_id
  LEFT JOIN tasks t ON t.assignee_id = u.id AND t.project_id = p_project_id
  LEFT JOIN activity_logs al ON al.user_id = u.id AND al.project_id = p_project_id
  GROUP BY u.id, u.email
  ORDER BY COALESCE(SUM(o.value) FILTER (WHERE o.status = 'won' AND o.updated_at BETWEEN p_start_date AND p_end_date), 0) DESC;
END;
$$;

-- Triggers for updated_at
CREATE TRIGGER update_report_definitions_updated_at
  BEFORE UPDATE ON report_definitions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_dashboard_widgets_updated_at
  BEFORE UPDATE ON dashboard_widgets
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
