-- Email send provider configurations (Gmail or Resend per project)
CREATE TABLE IF NOT EXISTS email_send_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('gmail', 'resend')),

  -- Gmail: references gmail_connections
  gmail_connection_id uuid REFERENCES gmail_connections(id) ON DELETE SET NULL,

  -- Resend: encrypted API key + verified domain
  resend_api_key_encrypted text,
  from_email text,
  from_name text,
  domain text,
  resend_domain_id text,
  domain_verified boolean DEFAULT false,

  -- Metadata
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(project_id, provider, from_email)
);

-- updated_at trigger
CREATE TRIGGER set_email_send_configs_updated_at
  BEFORE UPDATE ON email_send_configs
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- Only one default per project
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_send_configs_default
  ON email_send_configs (project_id)
  WHERE is_default = true;

-- RLS
ALTER TABLE email_send_configs ENABLE ROW LEVEL SECURITY;

-- Project members can read
CREATE POLICY "Project members can read email_send_configs"
  ON email_send_configs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = email_send_configs.project_id
        AND pm.user_id = auth.uid()
    )
  );

-- Admins and owners can insert
CREATE POLICY "Admins can insert email_send_configs"
  ON email_send_configs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = email_send_configs.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'admin')
    )
  );

-- Admins and owners can update
CREATE POLICY "Admins can update email_send_configs"
  ON email_send_configs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = email_send_configs.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'admin')
    )
  );

-- Admins and owners can delete
CREATE POLICY "Admins can delete email_send_configs"
  ON email_send_configs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = email_send_configs.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'admin')
    )
  );

-- Add send_config_id to broadcasts (nullable, for future provider selection)
ALTER TABLE broadcasts
  ADD COLUMN IF NOT EXISTS send_config_id uuid REFERENCES email_send_configs(id) ON DELETE SET NULL;
