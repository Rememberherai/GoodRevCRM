-- Migration 0167: Allow standalone contracts (project_id nullable)
-- Supports the Documents module where documents can exist without a CRM project.
-- Existing project-scoped contracts are unchanged — project_id is simply no longer required.

-- ============================================================
-- Make project_id nullable across the contracts subsystem
-- ============================================================

-- 1. contract_documents
ALTER TABLE contract_documents
  ALTER COLUMN project_id DROP NOT NULL;

-- 2. contract_templates
ALTER TABLE contract_templates
  ALTER COLUMN project_id DROP NOT NULL;

-- 3. contract_recipients
ALTER TABLE contract_recipients
  ALTER COLUMN project_id DROP NOT NULL;

-- 4. contract_fields
ALTER TABLE contract_fields
  ALTER COLUMN project_id DROP NOT NULL;

-- 5. contract_audit_trail
ALTER TABLE contract_audit_trail
  ALTER COLUMN project_id DROP NOT NULL;

-- ============================================================
-- Add indexes for standalone document queries
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_contract_documents_created_by
  ON contract_documents (created_by);

CREATE INDEX IF NOT EXISTS idx_contract_documents_standalone
  ON contract_documents (created_by)
  WHERE project_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_contract_templates_standalone
  ON contract_templates (created_by)
  WHERE project_id IS NULL;

-- ============================================================
-- Update RLS policies to support standalone access
-- ============================================================
-- Policy names match the originals in 0087–0091 migrations.
-- Pattern:
--   Parent tables (documents, templates): created_by = auth.uid()
--   Child tables (recipients, fields, audit_trail): join through contract_documents.created_by

-- ── contract_documents ──────────────────────────────────────

DROP POLICY IF EXISTS "contract_documents_select" ON contract_documents;
CREATE POLICY "contract_documents_select" ON contract_documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = contract_documents.project_id
      AND pm.user_id = auth.uid()
    )
    OR (
      contract_documents.project_id IS NULL
      AND contract_documents.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "contract_documents_insert" ON contract_documents;
CREATE POLICY "contract_documents_insert" ON contract_documents
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = contract_documents.project_id
      AND pm.user_id = auth.uid()
    )
    OR (
      contract_documents.project_id IS NULL
      AND contract_documents.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "contract_documents_update" ON contract_documents;
CREATE POLICY "contract_documents_update" ON contract_documents
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = contract_documents.project_id
      AND pm.user_id = auth.uid()
    )
    OR (
      contract_documents.project_id IS NULL
      AND contract_documents.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "contract_documents_delete" ON contract_documents;
CREATE POLICY "contract_documents_delete" ON contract_documents
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = contract_documents.project_id
      AND pm.user_id = auth.uid()
    )
    OR (
      contract_documents.project_id IS NULL
      AND contract_documents.created_by = auth.uid()
    )
  );

-- ── contract_templates ──────────────────────────────────────

DROP POLICY IF EXISTS "contract_templates_select" ON contract_templates;
CREATE POLICY "contract_templates_select" ON contract_templates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = contract_templates.project_id
      AND pm.user_id = auth.uid()
    )
    OR (
      contract_templates.project_id IS NULL
      AND contract_templates.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "contract_templates_insert" ON contract_templates;
CREATE POLICY "contract_templates_insert" ON contract_templates
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = contract_templates.project_id
      AND pm.user_id = auth.uid()
    )
    OR (
      contract_templates.project_id IS NULL
      AND contract_templates.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "contract_templates_update" ON contract_templates;
CREATE POLICY "contract_templates_update" ON contract_templates
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = contract_templates.project_id
      AND pm.user_id = auth.uid()
    )
    OR (
      contract_templates.project_id IS NULL
      AND contract_templates.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "contract_templates_delete" ON contract_templates;
CREATE POLICY "contract_templates_delete" ON contract_templates
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = contract_templates.project_id
      AND pm.user_id = auth.uid()
    )
    OR (
      contract_templates.project_id IS NULL
      AND contract_templates.created_by = auth.uid()
    )
  );

-- ── contract_recipients ─────────────────────────────────────
-- Child table: no created_by column. Standalone branch joins
-- through parent contract_documents.created_by.

DROP POLICY IF EXISTS "contract_recipients_select" ON contract_recipients;
CREATE POLICY "contract_recipients_select" ON contract_recipients
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = contract_recipients.project_id
      AND pm.user_id = auth.uid()
    )
    OR (
      contract_recipients.project_id IS NULL
      AND EXISTS (
        SELECT 1 FROM contract_documents cd
        WHERE cd.id = contract_recipients.document_id
        AND cd.created_by = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "contract_recipients_insert" ON contract_recipients;
CREATE POLICY "contract_recipients_insert" ON contract_recipients
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = contract_recipients.project_id
      AND pm.user_id = auth.uid()
    )
    OR (
      contract_recipients.project_id IS NULL
      AND EXISTS (
        SELECT 1 FROM contract_documents cd
        WHERE cd.id = contract_recipients.document_id
        AND cd.created_by = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "contract_recipients_update" ON contract_recipients;
CREATE POLICY "contract_recipients_update" ON contract_recipients
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = contract_recipients.project_id
      AND pm.user_id = auth.uid()
    )
    OR (
      contract_recipients.project_id IS NULL
      AND EXISTS (
        SELECT 1 FROM contract_documents cd
        WHERE cd.id = contract_recipients.document_id
        AND cd.created_by = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "contract_recipients_delete" ON contract_recipients;
CREATE POLICY "contract_recipients_delete" ON contract_recipients
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = contract_recipients.project_id
      AND pm.user_id = auth.uid()
    )
    OR (
      contract_recipients.project_id IS NULL
      AND EXISTS (
        SELECT 1 FROM contract_documents cd
        WHERE cd.id = contract_recipients.document_id
        AND cd.created_by = auth.uid()
      )
    )
  );

-- ── contract_fields ─────────────────────────────────────────
-- Child table: no created_by column. Same parent-join pattern.

DROP POLICY IF EXISTS "contract_fields_select" ON contract_fields;
CREATE POLICY "contract_fields_select" ON contract_fields
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = contract_fields.project_id
      AND pm.user_id = auth.uid()
    )
    OR (
      contract_fields.project_id IS NULL
      AND EXISTS (
        SELECT 1 FROM contract_documents cd
        WHERE cd.id = contract_fields.document_id
        AND cd.created_by = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "contract_fields_insert" ON contract_fields;
CREATE POLICY "contract_fields_insert" ON contract_fields
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = contract_fields.project_id
      AND pm.user_id = auth.uid()
    )
    OR (
      contract_fields.project_id IS NULL
      AND EXISTS (
        SELECT 1 FROM contract_documents cd
        WHERE cd.id = contract_fields.document_id
        AND cd.created_by = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "contract_fields_update" ON contract_fields;
CREATE POLICY "contract_fields_update" ON contract_fields
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = contract_fields.project_id
      AND pm.user_id = auth.uid()
    )
    OR (
      contract_fields.project_id IS NULL
      AND EXISTS (
        SELECT 1 FROM contract_documents cd
        WHERE cd.id = contract_fields.document_id
        AND cd.created_by = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "contract_fields_delete" ON contract_fields;
CREATE POLICY "contract_fields_delete" ON contract_fields
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = contract_fields.project_id
      AND pm.user_id = auth.uid()
    )
    OR (
      contract_fields.project_id IS NULL
      AND EXISTS (
        SELECT 1 FROM contract_documents cd
        WHERE cd.id = contract_fields.document_id
        AND cd.created_by = auth.uid()
      )
    )
  );

-- ── contract_audit_trail ────────────────────────────────────
-- SELECT only. All inserts use the service-role client (bypasses RLS).

DROP POLICY IF EXISTS "contract_audit_trail_select" ON contract_audit_trail;
CREATE POLICY "contract_audit_trail_select" ON contract_audit_trail
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = contract_audit_trail.project_id
      AND pm.user_id = auth.uid()
    )
    OR (
      contract_audit_trail.project_id IS NULL
      AND EXISTS (
        SELECT 1 FROM contract_documents cd
        WHERE cd.id = contract_audit_trail.document_id
        AND cd.created_by = auth.uid()
      )
    )
  );
