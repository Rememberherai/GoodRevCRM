-- Research jobs table for tracking AI research requests
CREATE TABLE research_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('organization', 'person', 'opportunity', 'rfp')),
  entity_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  prompt TEXT NOT NULL,
  result JSONB,
  error TEXT,
  model_used TEXT,
  tokens_used INTEGER,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_research_jobs_project ON research_jobs(project_id);
CREATE INDEX idx_research_jobs_entity ON research_jobs(entity_type, entity_id);
CREATE INDEX idx_research_jobs_status ON research_jobs(status);
CREATE INDEX idx_research_jobs_created ON research_jobs(created_at DESC);

-- Enable RLS
ALTER TABLE research_jobs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view research jobs in their projects"
  ON research_jobs FOR SELECT
  USING (
    project_id IN (
      SELECT project_id FROM project_memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create research jobs in their projects"
  ON research_jobs FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT project_id FROM project_memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update research jobs they created"
  ON research_jobs FOR UPDATE
  USING (
    created_by = auth.uid() OR
    project_id IN (
      SELECT project_id FROM project_memberships
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );
