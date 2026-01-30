-- Activity log table for tracking all changes
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL, -- 'person', 'organization', 'opportunity', 'rfp', 'task', 'note', etc.
  entity_id UUID NOT NULL,
  action TEXT NOT NULL, -- 'created', 'updated', 'deleted', 'restored', etc.
  changes JSONB DEFAULT '{}'::jsonb, -- For updates, stores old and new values
  metadata JSONB DEFAULT '{}'::jsonb, -- Additional context
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_activity_log_project_id ON activity_log(project_id);
CREATE INDEX idx_activity_log_entity ON activity_log(entity_type, entity_id);
CREATE INDEX idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX idx_activity_log_created_at ON activity_log(created_at DESC);
CREATE INDEX idx_activity_log_action ON activity_log(action);

-- Composite index for common queries
CREATE INDEX idx_activity_log_project_entity ON activity_log(project_id, entity_type, entity_id);

-- RLS policies
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view activity for their projects"
  ON activity_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = activity_log.project_id
      AND project_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert activity for their projects"
  ON activity_log
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = activity_log.project_id
      AND project_members.user_id = auth.uid()
    )
  );

-- Function to log activity
CREATE OR REPLACE FUNCTION log_activity(
  p_project_id UUID,
  p_user_id UUID,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_action TEXT,
  p_changes JSONB DEFAULT '{}'::jsonb,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  v_activity_id UUID;
BEGIN
  INSERT INTO activity_log (
    project_id,
    user_id,
    entity_type,
    entity_id,
    action,
    changes,
    metadata
  ) VALUES (
    p_project_id,
    p_user_id,
    p_entity_type,
    p_entity_id,
    p_action,
    p_changes,
    p_metadata
  )
  RETURNING id INTO v_activity_id;

  RETURN v_activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION log_activity TO authenticated;
