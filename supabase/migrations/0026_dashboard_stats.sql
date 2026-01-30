-- Dashboard statistics function for Phase 13
CREATE OR REPLACE FUNCTION get_dashboard_stats(p_project_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'pipeline', (
      SELECT json_build_object(
        'total_value', COALESCE(SUM(amount), 0),
        'total_count', COUNT(*),
        'by_stage', (
          SELECT json_agg(stage_stats)
          FROM (
            SELECT
              stage,
              COUNT(*) as count,
              COALESCE(SUM(amount), 0) as value
            FROM opportunities
            WHERE project_id = p_project_id AND deleted_at IS NULL
            GROUP BY stage
            ORDER BY
              CASE stage
                WHEN 'prospecting' THEN 1
                WHEN 'qualification' THEN 2
                WHEN 'proposal' THEN 3
                WHEN 'negotiation' THEN 4
                WHEN 'closed_won' THEN 5
                WHEN 'closed_lost' THEN 6
              END
          ) stage_stats
        ),
        'won_this_month', (
          SELECT COALESCE(SUM(amount), 0)
          FROM opportunities
          WHERE project_id = p_project_id
            AND deleted_at IS NULL
            AND stage = 'closed_won'
            AND updated_at >= date_trunc('month', CURRENT_DATE)
        )
      )
      FROM opportunities
      WHERE project_id = p_project_id AND deleted_at IS NULL
    ),
    'rfps', (
      SELECT json_build_object(
        'total_count', COUNT(*),
        'by_status', (
          SELECT json_agg(status_stats)
          FROM (
            SELECT status, COUNT(*) as count
            FROM rfps
            WHERE project_id = p_project_id AND deleted_at IS NULL
            GROUP BY status
          ) status_stats
        ),
        'upcoming_deadlines', (
          SELECT json_agg(upcoming)
          FROM (
            SELECT id, title, due_date, status
            FROM rfps
            WHERE project_id = p_project_id
              AND deleted_at IS NULL
              AND due_date >= CURRENT_DATE
              AND status NOT IN ('won', 'lost', 'no_bid')
            ORDER BY due_date
            LIMIT 5
          ) upcoming
        )
      )
      FROM rfps
      WHERE project_id = p_project_id AND deleted_at IS NULL
    ),
    'entities', (
      SELECT json_build_object(
        'organizations', (SELECT COUNT(*) FROM organizations WHERE project_id = p_project_id AND deleted_at IS NULL),
        'people', (SELECT COUNT(*) FROM people WHERE project_id = p_project_id AND deleted_at IS NULL),
        'opportunities', (SELECT COUNT(*) FROM opportunities WHERE project_id = p_project_id AND deleted_at IS NULL),
        'rfps', (SELECT COUNT(*) FROM rfps WHERE project_id = p_project_id AND deleted_at IS NULL)
      )
    ),
    'tasks', (
      SELECT json_build_object(
        'pending', COUNT(*) FILTER (WHERE status = 'pending'),
        'in_progress', COUNT(*) FILTER (WHERE status = 'in_progress'),
        'overdue', COUNT(*) FILTER (WHERE status IN ('pending', 'in_progress') AND due_date < CURRENT_DATE),
        'due_today', COUNT(*) FILTER (WHERE status IN ('pending', 'in_progress') AND due_date::DATE = CURRENT_DATE)
      )
      FROM tasks
      WHERE project_id = p_project_id
    ),
    'recent_activity', (
      SELECT json_agg(activity)
      FROM (
        SELECT 'organization' as type, id, name as title, created_at
        FROM organizations
        WHERE project_id = p_project_id AND deleted_at IS NULL
        UNION ALL
        SELECT 'person', id, CONCAT(first_name, ' ', last_name), created_at
        FROM people
        WHERE project_id = p_project_id AND deleted_at IS NULL
        UNION ALL
        SELECT 'opportunity', id, name, created_at
        FROM opportunities
        WHERE project_id = p_project_id AND deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT 10
      ) activity
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;
