-- Migration 0140: Admin dashboard RPC functions
-- Helper functions for the admin stats dashboard.

------------------------------------------------------------------------
-- Count projects with activity in the last 7 days
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.count_active_projects_7d()
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COUNT(DISTINCT project_id)
  FROM public.activity_log
  WHERE created_at > NOW() - INTERVAL '7 days';
$$;

------------------------------------------------------------------------
-- Count projects missing an OpenRouter API key
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.count_projects_missing_api_key()
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COUNT(*)
  FROM public.projects p
  WHERE p.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.project_secrets ps
      WHERE ps.project_id = p.id
        AND ps.key_name = 'openrouter'
    );
$$;

------------------------------------------------------------------------
-- Signups by week (last 12 weeks)
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.signups_by_week()
RETURNS TABLE(week TEXT, count BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    TO_CHAR(date_trunc('week', created_at), 'YYYY-MM-DD') AS week,
    COUNT(*) AS count
  FROM public.users
  WHERE created_at > NOW() - INTERVAL '12 weeks'
  GROUP BY date_trunc('week', created_at)
  ORDER BY date_trunc('week', created_at);
$$;

------------------------------------------------------------------------
-- Projects created by week (last 12 weeks)
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.projects_by_week()
RETURNS TABLE(week TEXT, count BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    TO_CHAR(date_trunc('week', created_at), 'YYYY-MM-DD') AS week,
    COUNT(*) AS count
  FROM public.projects
  WHERE created_at > NOW() - INTERVAL '12 weeks'
    AND deleted_at IS NULL
  GROUP BY date_trunc('week', created_at)
  ORDER BY date_trunc('week', created_at);
$$;
