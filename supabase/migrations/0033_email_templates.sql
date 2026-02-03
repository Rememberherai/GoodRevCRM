-- Phase 23: Email Templates
-- Reusable email templates with variable substitution

-- ============================================================================
-- EMAIL TEMPLATES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  subject VARCHAR(500) NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  category VARCHAR(50) CHECK (category IN (
    'outreach', 'follow_up', 'introduction', 'proposal', 'thank_you',
    'meeting', 'reminder', 'newsletter', 'announcement', 'other'
  )) DEFAULT 'other',
  variables JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_shared BOOLEAN NOT NULL DEFAULT false,
  usage_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, name)
);

-- Template versions for history
CREATE TABLE IF NOT EXISTS email_template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES email_templates(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  subject VARCHAR(500) NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  change_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(template_id, version)
);

-- Template attachments
CREATE TABLE IF NOT EXISTS email_template_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES email_templates(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(100) NOT NULL,
  file_size INTEGER NOT NULL,
  file_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Email drafts (pre-composed emails from templates)
CREATE TABLE IF NOT EXISTS email_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id UUID REFERENCES persons(id) ON DELETE SET NULL,
  subject VARCHAR(500) NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  to_addresses JSONB NOT NULL DEFAULT '[]',
  cc_addresses JSONB NOT NULL DEFAULT '[]',
  bcc_addresses JSONB NOT NULL DEFAULT '[]',
  reply_to VARCHAR(255),
  scheduled_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_email_templates_project ON email_templates(project_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_category ON email_templates(category);
CREATE INDEX IF NOT EXISTS idx_email_templates_active ON email_templates(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_email_template_versions_template ON email_template_versions(template_id);
CREATE INDEX IF NOT EXISTS idx_email_template_attachments_template ON email_template_attachments(template_id);
CREATE INDEX IF NOT EXISTS idx_email_drafts_project ON email_drafts(project_id);
CREATE INDEX IF NOT EXISTS idx_email_drafts_user ON email_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_email_drafts_status ON email_drafts(status);
CREATE INDEX IF NOT EXISTS idx_email_drafts_scheduled ON email_drafts(scheduled_at) WHERE status = 'scheduled';

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_template_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_drafts ENABLE ROW LEVEL SECURITY;

-- Email templates policies
DROP POLICY IF EXISTS "Users can view templates in their projects" ON email_templates;
CREATE POLICY "Users can view templates in their projects"
  ON email_templates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = email_templates.project_id
      AND pm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Members can create templates" ON email_templates;
CREATE POLICY "Members can create templates"
  ON email_templates FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = email_templates.project_id
      AND pm.user_id = auth.uid()
      AND pm.role IN ('owner', 'admin', 'member')
    )
  );

DROP POLICY IF EXISTS "Members can update templates" ON email_templates;
CREATE POLICY "Members can update templates"
  ON email_templates FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = email_templates.project_id
      AND pm.user_id = auth.uid()
      AND pm.role IN ('owner', 'admin', 'member')
    )
  );

DROP POLICY IF EXISTS "Admins can delete templates" ON email_templates;
CREATE POLICY "Admins can delete templates"
  ON email_templates FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = email_templates.project_id
      AND pm.user_id = auth.uid()
      AND pm.role IN ('owner', 'admin')
    )
  );

-- Template versions policies
DROP POLICY IF EXISTS "Users can view template versions" ON email_template_versions;
CREATE POLICY "Users can view template versions"
  ON email_template_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM email_templates et
      JOIN project_memberships pm ON pm.project_id = et.project_id
      WHERE et.id = email_template_versions.template_id
      AND pm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "System can manage template versions" ON email_template_versions;
CREATE POLICY "System can manage template versions"
  ON email_template_versions FOR ALL
  USING (true);

-- Template attachments policies
DROP POLICY IF EXISTS "Users can view template attachments" ON email_template_attachments;
CREATE POLICY "Users can view template attachments"
  ON email_template_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM email_templates et
      JOIN project_memberships pm ON pm.project_id = et.project_id
      WHERE et.id = email_template_attachments.template_id
      AND pm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Members can manage template attachments" ON email_template_attachments;
CREATE POLICY "Members can manage template attachments"
  ON email_template_attachments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM email_templates et
      JOIN project_memberships pm ON pm.project_id = et.project_id
      WHERE et.id = email_template_attachments.template_id
      AND pm.user_id = auth.uid()
      AND pm.role IN ('owner', 'admin', 'member')
    )
  );

-- Email drafts policies
DROP POLICY IF EXISTS "Users can view their own drafts" ON email_drafts;
CREATE POLICY "Users can view their own drafts"
  ON email_drafts FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage their own drafts" ON email_drafts;
CREATE POLICY "Users can manage their own drafts"
  ON email_drafts FOR ALL
  USING (user_id = auth.uid());

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to create a new template version
CREATE OR REPLACE FUNCTION create_template_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_version INTEGER;
BEGIN
  -- Get next version number
  SELECT COALESCE(MAX(version), 0) + 1
  INTO v_version
  FROM email_template_versions
  WHERE template_id = OLD.id;

  -- Insert version record
  INSERT INTO email_template_versions (
    template_id,
    version,
    subject,
    body_html,
    body_text,
    changed_by
  ) VALUES (
    OLD.id,
    v_version,
    OLD.subject,
    OLD.body_html,
    OLD.body_text,
    auth.uid()
  );

  RETURN NEW;
END;
$$;

-- Trigger to save versions on template update
DROP TRIGGER IF EXISTS save_template_version ON email_templates;
CREATE TRIGGER save_template_version
  BEFORE UPDATE OF subject, body_html, body_text ON email_templates
  FOR EACH ROW
  WHEN (OLD.subject IS DISTINCT FROM NEW.subject OR
        OLD.body_html IS DISTINCT FROM NEW.body_html OR
        OLD.body_text IS DISTINCT FROM NEW.body_text)
  EXECUTE FUNCTION create_template_version();

-- Function to render template with variables
CREATE OR REPLACE FUNCTION render_email_template(
  p_template_id UUID,
  p_variables JSONB DEFAULT '{}'
)
RETURNS TABLE (
  subject TEXT,
  body_html TEXT,
  body_text TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_template RECORD;
  v_subject TEXT;
  v_body_html TEXT;
  v_body_text TEXT;
  v_key TEXT;
  v_value TEXT;
BEGIN
  -- Get template
  SELECT et.subject, et.body_html, et.body_text
  INTO v_template
  FROM email_templates et
  WHERE et.id = p_template_id AND et.is_active = true;

  IF v_template IS NULL THEN
    RAISE EXCEPTION 'Template not found or inactive';
  END IF;

  v_subject := v_template.subject;
  v_body_html := v_template.body_html;
  v_body_text := v_template.body_text;

  -- Replace variables
  FOR v_key, v_value IN SELECT * FROM jsonb_each_text(p_variables) LOOP
    v_subject := REPLACE(v_subject, '{{' || v_key || '}}', COALESCE(v_value, ''));
    v_body_html := REPLACE(v_body_html, '{{' || v_key || '}}', COALESCE(v_value, ''));
    IF v_body_text IS NOT NULL THEN
      v_body_text := REPLACE(v_body_text, '{{' || v_key || '}}', COALESCE(v_value, ''));
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_subject, v_body_html, v_body_text;
END;
$$;

-- Function to increment template usage
CREATE OR REPLACE FUNCTION increment_template_usage(p_template_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE email_templates
  SET
    usage_count = usage_count + 1,
    last_used_at = NOW()
  WHERE id = p_template_id;
END;
$$;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_email_templates_updated_at ON email_templates;
CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS update_email_drafts_updated_at ON email_drafts;
CREATE TRIGGER update_email_drafts_updated_at
  BEFORE UPDATE ON email_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
