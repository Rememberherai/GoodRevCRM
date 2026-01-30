-- Email sequences table
CREATE TABLE sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  settings JSONB NOT NULL DEFAULT '{
    "send_as_reply": true,
    "stop_on_reply": true,
    "stop_on_bounce": true,
    "track_opens": true,
    "track_clicks": true
  }',
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_sequences_project ON sequences(project_id);
CREATE INDEX idx_sequences_status ON sequences(status);
CREATE INDEX idx_sequences_created ON sequences(created_at DESC);

-- Enable RLS
ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view sequences in their projects"
  ON sequences FOR SELECT
  USING (
    project_id IN (
      SELECT project_id FROM project_memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create sequences in their projects"
  ON sequences FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT project_id FROM project_memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update sequences in their projects"
  ON sequences FOR UPDATE
  USING (
    project_id IN (
      SELECT project_id FROM project_memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can delete sequences"
  ON sequences FOR DELETE
  USING (
    project_id IN (
      SELECT project_id FROM project_memberships
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );
