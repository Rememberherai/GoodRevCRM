-- Migration: 0031_user_management.sql
-- Description: Enhanced user management with invitations and teams

-- Team invitations table
CREATE TABLE IF NOT EXISTS project_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'member',
  invited_by UUID NOT NULL REFERENCES users(id),
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User settings table
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  theme VARCHAR(20) DEFAULT 'system',
  timezone VARCHAR(100) DEFAULT 'UTC',
  date_format VARCHAR(20) DEFAULT 'MMM dd, yyyy',
  time_format VARCHAR(20) DEFAULT 'HH:mm',
  notifications_email BOOLEAN DEFAULT true,
  notifications_push BOOLEAN DEFAULT true,
  notifications_digest VARCHAR(20) DEFAULT 'daily',
  default_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User activity tracking
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  ip_address VARCHAR(45),
  user_agent TEXT,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for project_invitations
ALTER TABLE project_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view invitations for their projects"
  ON project_invitations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = project_invitations.project_id
        AND project_members.user_id = auth.uid()
        AND project_members.role IN ('owner', 'admin')
    )
    OR email = (SELECT email FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Admins can create invitations"
  ON project_invitations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = project_invitations.project_id
        AND project_members.user_id = auth.uid()
        AND project_members.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can delete invitations"
  ON project_invitations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = project_invitations.project_id
        AND project_members.user_id = auth.uid()
        AND project_members.role IN ('owner', 'admin')
    )
  );

-- RLS for user_settings
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own settings"
  ON user_settings FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own settings"
  ON user_settings FOR ALL
  USING (user_id = auth.uid());

-- RLS for user_sessions
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sessions"
  ON user_sessions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own sessions"
  ON user_sessions FOR ALL
  USING (user_id = auth.uid());

-- Function to accept invitation
CREATE OR REPLACE FUNCTION accept_invitation(p_token VARCHAR(255))
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invitation RECORD;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_invitation
  FROM project_invitations
  WHERE token = p_token
    AND accepted_at IS NULL
    AND expires_at > NOW();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invitation');
  END IF;

  -- Verify email matches
  IF NOT EXISTS (
    SELECT 1 FROM users
    WHERE id = v_user_id AND email = v_invitation.email
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email does not match invitation');
  END IF;

  -- Check if already a member
  IF EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = v_invitation.project_id AND user_id = v_user_id
  ) THEN
    -- Mark invitation as accepted and return
    UPDATE project_invitations SET accepted_at = NOW() WHERE id = v_invitation.id;
    RETURN jsonb_build_object('success', true, 'message', 'Already a member');
  END IF;

  -- Add user to project
  INSERT INTO project_members (project_id, user_id, role)
  VALUES (v_invitation.project_id, v_user_id, v_invitation.role);

  -- Mark invitation as accepted
  UPDATE project_invitations SET accepted_at = NOW() WHERE id = v_invitation.id;

  RETURN jsonb_build_object('success', true, 'project_id', v_invitation.project_id);
END;
$$;

-- Function to get project members with user info
CREATE OR REPLACE FUNCTION get_project_members(p_project_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  role VARCHAR(50),
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
  FROM project_members pm
  JOIN users u ON u.id = pm.user_id
  WHERE pm.project_id = p_project_id
  ORDER BY pm.role, u.full_name;
END;
$$;

-- Function to update member role
CREATE OR REPLACE FUNCTION update_member_role(
  p_project_id UUID,
  p_user_id UUID,
  p_new_role VARCHAR(50)
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_user_role VARCHAR(50);
  v_target_user_role VARCHAR(50);
BEGIN
  -- Get current user's role
  SELECT role INTO v_current_user_role
  FROM project_members
  WHERE project_id = p_project_id AND user_id = auth.uid();

  -- Only owners and admins can change roles
  IF v_current_user_role NOT IN ('owner', 'admin') THEN
    RETURN false;
  END IF;

  -- Get target user's current role
  SELECT role INTO v_target_user_role
  FROM project_members
  WHERE project_id = p_project_id AND user_id = p_user_id;

  -- Can't change owner's role
  IF v_target_user_role = 'owner' THEN
    RETURN false;
  END IF;

  -- Admins can only change members, not other admins
  IF v_current_user_role = 'admin' AND v_target_user_role = 'admin' THEN
    RETURN false;
  END IF;

  -- Can't promote to owner
  IF p_new_role = 'owner' THEN
    RETURN false;
  END IF;

  UPDATE project_members
  SET role = p_new_role
  WHERE project_id = p_project_id AND user_id = p_user_id;

  RETURN FOUND;
END;
$$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_project_invitations_project ON project_invitations(project_id);
CREATE INDEX IF NOT EXISTS idx_project_invitations_email ON project_invitations(email);
CREATE INDEX IF NOT EXISTS idx_project_invitations_token ON project_invitations(token);
CREATE INDEX IF NOT EXISTS idx_user_settings_user ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_project ON user_sessions(project_id);

-- Update timestamp trigger for user_settings
CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
