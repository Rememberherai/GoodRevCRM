-- Sent emails table for tracking outbound emails
CREATE TABLE sent_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  gmail_connection_id UUID NOT NULL REFERENCES gmail_connections(id) ON DELETE CASCADE,

  -- Entity associations (at least one should be set)
  person_id UUID REFERENCES people(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  rfp_id UUID REFERENCES rfps(id) ON DELETE SET NULL,

  -- Sequence tracking (optional)
  sequence_enrollment_id UUID,

  -- Gmail message IDs
  thread_id TEXT,
  message_id TEXT NOT NULL,

  -- Email content
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,

  -- Tracking
  tracking_id UUID NOT NULL DEFAULT gen_random_uuid(),

  -- Metadata
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX idx_sent_emails_project ON sent_emails(project_id);
CREATE INDEX idx_sent_emails_person ON sent_emails(person_id) WHERE person_id IS NOT NULL;
CREATE INDEX idx_sent_emails_organization ON sent_emails(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX idx_sent_emails_opportunity ON sent_emails(opportunity_id) WHERE opportunity_id IS NOT NULL;
CREATE INDEX idx_sent_emails_rfp ON sent_emails(rfp_id) WHERE rfp_id IS NOT NULL;
CREATE INDEX idx_sent_emails_tracking ON sent_emails(tracking_id);
CREATE INDEX idx_sent_emails_thread ON sent_emails(thread_id) WHERE thread_id IS NOT NULL;
CREATE INDEX idx_sent_emails_sent_at ON sent_emails(sent_at DESC);

-- Enable RLS
ALTER TABLE sent_emails ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view sent emails in their projects"
  ON sent_emails FOR SELECT
  USING (
    project_id IN (
      SELECT project_id FROM project_memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert sent emails in their projects"
  ON sent_emails FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT project_id FROM project_memberships WHERE user_id = auth.uid()
    )
  );
