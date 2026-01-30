-- Gmail connections table for storing OAuth credentials
CREATE TABLE gmail_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected', 'expired', 'error')),
  last_sync_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Each user can only have one connection per email per project
  UNIQUE(user_id, project_id, email)
);

-- Indexes
CREATE INDEX idx_gmail_connections_user ON gmail_connections(user_id);
CREATE INDEX idx_gmail_connections_project ON gmail_connections(project_id);
CREATE INDEX idx_gmail_connections_status ON gmail_connections(status);

-- Enable RLS
ALTER TABLE gmail_connections ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own Gmail connections"
  ON gmail_connections FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own Gmail connections"
  ON gmail_connections FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own Gmail connections"
  ON gmail_connections FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own Gmail connections"
  ON gmail_connections FOR DELETE
  USING (user_id = auth.uid());
