-- Fix: cast VARCHAR role to project_role enum when inserting into project_memberships
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
    SELECT 1 FROM project_memberships
    WHERE project_id = v_invitation.project_id AND user_id = v_user_id
  ) THEN
    -- Mark invitation as accepted and return
    UPDATE project_invitations SET accepted_at = NOW() WHERE id = v_invitation.id;
    RETURN jsonb_build_object('success', true, 'message', 'Already a member');
  END IF;

  -- Add user to project (cast role VARCHAR to project_role enum)
  INSERT INTO project_memberships (project_id, user_id, role)
  VALUES (v_invitation.project_id, v_user_id, v_invitation.role::project_role);

  -- Mark invitation as accepted
  UPDATE project_invitations SET accepted_at = NOW() WHERE id = v_invitation.id;

  RETURN jsonb_build_object('success', true, 'project_id', v_invitation.project_id);
END;
$$;
