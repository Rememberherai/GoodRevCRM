-- Enrichment jobs table for tracking FullEnrich requests
CREATE TABLE enrichment_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  external_job_id TEXT, -- FullEnrich job ID for bulk operations
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  input_data JSONB NOT NULL DEFAULT '{}',
  result JSONB,
  error TEXT,
  credits_used INTEGER,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_enrichment_jobs_project ON enrichment_jobs(project_id);
CREATE INDEX idx_enrichment_jobs_person ON enrichment_jobs(person_id);
CREATE INDEX idx_enrichment_jobs_external ON enrichment_jobs(external_job_id) WHERE external_job_id IS NOT NULL;
CREATE INDEX idx_enrichment_jobs_status ON enrichment_jobs(status);
CREATE INDEX idx_enrichment_jobs_created ON enrichment_jobs(created_at DESC);

-- Enable RLS
ALTER TABLE enrichment_jobs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view enrichment jobs in their projects"
  ON enrichment_jobs FOR SELECT
  USING (
    project_id IN (
      SELECT project_id FROM project_memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create enrichment jobs in their projects"
  ON enrichment_jobs FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT project_id FROM project_memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update enrichment jobs they created or as admin"
  ON enrichment_jobs FOR UPDATE
  USING (
    created_by = auth.uid() OR
    project_id IN (
      SELECT project_id FROM project_memberships
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Webhook service role can update any job (for async processing)
CREATE POLICY "Service role can update any enrichment job"
  ON enrichment_jobs FOR UPDATE
  USING (auth.jwt() ->> 'role' = 'service_role');
