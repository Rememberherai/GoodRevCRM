-- ============================================================================
-- 0167: Add design_json for block-based email builder
-- Additive only. All columns nullable. No data migration needed.
-- ============================================================================

-- ── Add design_json columns ───────────────────────────────────────────────

ALTER TABLE broadcasts
  ADD COLUMN IF NOT EXISTS design_json jsonb;

ALTER TABLE email_templates
  ADD COLUMN IF NOT EXISTS design_json jsonb;

ALTER TABLE email_template_versions
  ADD COLUMN IF NOT EXISTS design_json jsonb;

ALTER TABLE sequence_steps
  ADD COLUMN IF NOT EXISTS design_json jsonb;

-- ── Update template version trigger to include design_json ────────────────

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

  -- Insert version record (now includes design_json)
  INSERT INTO email_template_versions (
    template_id,
    version,
    subject,
    body_html,
    body_text,
    design_json,
    changed_by
  ) VALUES (
    OLD.id,
    v_version,
    OLD.subject,
    OLD.body_html,
    OLD.body_text,
    OLD.design_json,
    auth.uid()
  );

  RETURN NEW;
END;
$$;

-- Update trigger to also fire on design_json changes
DROP TRIGGER IF EXISTS save_template_version ON email_templates;
CREATE TRIGGER save_template_version
  BEFORE UPDATE OF subject, body_html, body_text, design_json ON email_templates
  FOR EACH ROW
  WHEN (OLD.subject IS DISTINCT FROM NEW.subject OR
        OLD.body_html IS DISTINCT FROM NEW.body_html OR
        OLD.body_text IS DISTINCT FROM NEW.body_text OR
        OLD.design_json IS DISTINCT FROM NEW.design_json)
  EXECUTE FUNCTION create_template_version();
