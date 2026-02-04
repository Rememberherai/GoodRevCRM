-- Migration: Inbound Email Sync
-- Adds Gmail push notification sync infrastructure, unified emails table, and sync logging

-- A. Extend gmail_connections with sync state columns
ALTER TABLE gmail_connections ADD COLUMN IF NOT EXISTS history_id TEXT;
ALTER TABLE gmail_connections ADD COLUMN IF NOT EXISTS initial_sync_done BOOLEAN DEFAULT FALSE;
ALTER TABLE gmail_connections ADD COLUMN IF NOT EXISTS sync_errors_count INTEGER DEFAULT 0;
ALTER TABLE gmail_connections ADD COLUMN IF NOT EXISTS last_sync_error TEXT;
ALTER TABLE gmail_connections ADD COLUMN IF NOT EXISTS sync_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE gmail_connections ADD COLUMN IF NOT EXISTS watch_expiration TIMESTAMPTZ;

-- B. Create unified emails table (inbound + outbound)
CREATE TABLE IF NOT EXISTS emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_connection_id UUID NOT NULL REFERENCES gmail_connections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Gmail identifiers
  gmail_message_id TEXT NOT NULL,
  gmail_thread_id TEXT NOT NULL,

  -- Email envelope
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_emails TEXT[] NOT NULL DEFAULT '{}',
  cc_emails TEXT[] DEFAULT '{}',
  bcc_emails TEXT[] DEFAULT '{}',
  subject TEXT,
  snippet TEXT,

  -- Body content
  body_html TEXT,
  body_text TEXT,

  -- Parsed date from Gmail internalDate
  email_date TIMESTAMPTZ NOT NULL,

  -- Gmail labels
  label_ids TEXT[] DEFAULT '{}',

  -- Attachment metadata (references only, not content)
  attachments JSONB DEFAULT '[]',

  -- Entity matching
  person_id UUID REFERENCES people(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  rfp_id UUID REFERENCES rfps(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,

  -- Link to sent_emails record for outbound messages
  sent_email_id UUID REFERENCES sent_emails(id) ON DELETE SET NULL,

  -- Sync metadata
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate imports
  UNIQUE(gmail_connection_id, gmail_message_id)
);

-- Indexes for emails table
CREATE INDEX IF NOT EXISTS idx_emails_user ON emails(user_id);
CREATE INDEX IF NOT EXISTS idx_emails_gmail_thread ON emails(gmail_thread_id);
CREATE INDEX IF NOT EXISTS idx_emails_direction ON emails(direction);
CREATE INDEX IF NOT EXISTS idx_emails_email_date ON emails(email_date DESC);
CREATE INDEX IF NOT EXISTS idx_emails_person ON emails(person_id) WHERE person_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_emails_organization ON emails(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_emails_project ON emails(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_emails_from ON emails(from_email);
CREATE INDEX IF NOT EXISTS idx_emails_gmail_connection ON emails(gmail_connection_id);
CREATE INDEX IF NOT EXISTS idx_emails_to ON emails USING gin(to_emails);

-- RLS for emails
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own emails"
  ON emails FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Project members can view matched emails"
  ON emails FOR SELECT
  USING (
    project_id IS NOT NULL AND
    project_id IN (
      SELECT project_id FROM project_memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert emails"
  ON emails FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update emails"
  ON emails FOR UPDATE
  USING (true);

-- Updated_at trigger for emails
CREATE TRIGGER set_emails_updated_at
  BEFORE UPDATE ON emails
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- C. Create email_sync_log table for observability
CREATE TABLE IF NOT EXISTS email_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_connection_id UUID NOT NULL REFERENCES gmail_connections(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL CHECK (sync_type IN ('initial', 'incremental', 'manual')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  messages_fetched INTEGER DEFAULT 0,
  messages_stored INTEGER DEFAULT 0,
  contacts_matched INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_email_sync_log_connection
  ON email_sync_log(gmail_connection_id, started_at DESC);
