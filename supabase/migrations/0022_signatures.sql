-- Email signatures table
CREATE TABLE email_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content_html TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_signatures_user ON email_signatures(user_id);
CREATE INDEX idx_signatures_project ON email_signatures(project_id);
CREATE INDEX idx_signatures_default ON email_signatures(user_id, project_id, is_default)
  WHERE is_default = true;

-- Enable RLS
ALTER TABLE email_signatures ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own signatures"
  ON email_signatures FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own signatures"
  ON email_signatures FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own signatures"
  ON email_signatures FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own signatures"
  ON email_signatures FOR DELETE
  USING (user_id = auth.uid());

-- Function to ensure only one default signature per user per project
CREATE OR REPLACE FUNCTION ensure_single_default_signature()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE email_signatures
    SET is_default = false
    WHERE user_id = NEW.user_id
      AND project_id = NEW.project_id
      AND id != NEW.id
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ensure_single_default_signature
  BEFORE INSERT OR UPDATE ON email_signatures
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_default_signature();
