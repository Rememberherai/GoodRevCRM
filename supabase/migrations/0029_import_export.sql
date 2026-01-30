-- Migration: 0029_import_export.sql
-- Description: Import/Export jobs tracking

-- Import jobs table
CREATE TABLE IF NOT EXISTS import_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  entity_type VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT,
  total_rows INTEGER DEFAULT 0,
  processed_rows INTEGER DEFAULT 0,
  successful_rows INTEGER DEFAULT 0,
  failed_rows INTEGER DEFAULT 0,
  error_log JSONB DEFAULT '[]'::JSONB,
  mapping JSONB DEFAULT '{}'::JSONB,
  options JSONB DEFAULT '{}'::JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Export jobs table
CREATE TABLE IF NOT EXISTS export_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  entity_type VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  format VARCHAR(20) NOT NULL DEFAULT 'csv',
  file_name VARCHAR(255),
  file_url TEXT,
  total_rows INTEGER DEFAULT 0,
  filters JSONB DEFAULT '{}'::JSONB,
  columns JSONB DEFAULT '[]'::JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for import_jobs
ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view import jobs in their projects"
  ON import_jobs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_memberships
      WHERE project_memberships.project_id = import_jobs.project_id
        AND project_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create import jobs in their projects"
  ON import_jobs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_memberships
      WHERE project_memberships.project_id = import_jobs.project_id
        AND project_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own import jobs"
  ON import_jobs FOR UPDATE
  USING (user_id = auth.uid());

-- RLS for export_jobs
ALTER TABLE export_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view export jobs in their projects"
  ON export_jobs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_memberships
      WHERE project_memberships.project_id = export_jobs.project_id
        AND project_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create export jobs in their projects"
  ON export_jobs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_memberships
      WHERE project_memberships.project_id = export_jobs.project_id
        AND project_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own export jobs"
  ON export_jobs FOR UPDATE
  USING (user_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_import_jobs_project ON import_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_user ON import_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON import_jobs(status);
CREATE INDEX IF NOT EXISTS idx_export_jobs_project ON export_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_export_jobs_user ON export_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_export_jobs_status ON export_jobs(status);

-- Update timestamp trigger
CREATE TRIGGER update_import_jobs_updated_at
  BEFORE UPDATE ON import_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_export_jobs_updated_at
  BEFORE UPDATE ON export_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
