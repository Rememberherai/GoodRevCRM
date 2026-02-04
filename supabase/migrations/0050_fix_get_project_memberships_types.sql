-- Migration 0050: Fix get_project_memberships return type mismatch
-- The role column is project_role enum but the function declared VARCHAR(50)
-- Must DROP first because CREATE OR REPLACE cannot change return types

DROP FUNCTION IF EXISTS get_project_memberships(UUID);

CREATE OR REPLACE FUNCTION get_project_memberships(p_project_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  role public.project_role,
  joined_at TIMESTAMPTZ,
  full_name VARCHAR(255),
  email VARCHAR(255),
  avatar_url TEXT,
  last_active_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pm.id,
    pm.user_id,
    pm.role,
    pm.created_at as joined_at,
    u.full_name,
    u.email,
    u.avatar_url,
    (
      SELECT us.last_active_at
      FROM user_sessions us
      WHERE us.user_id = pm.user_id
        AND us.project_id = p_project_id
      ORDER BY us.last_active_at DESC
      LIMIT 1
    ) as last_active_at
  FROM project_memberships pm
  JOIN users u ON u.id = pm.user_id
  WHERE pm.project_id = p_project_id
  ORDER BY pm.role, u.full_name;
END;
$$;
