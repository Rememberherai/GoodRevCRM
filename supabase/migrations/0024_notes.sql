-- Notes table for Phase 16
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  content TEXT NOT NULL,
  content_html TEXT,

  -- Entity associations (polymorphic - at least one required)
  person_id UUID REFERENCES people(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE CASCADE,
  rfp_id UUID REFERENCES rfps(id) ON DELETE CASCADE,

  -- Pinned notes appear first
  is_pinned BOOLEAN NOT NULL DEFAULT false,

  created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notes_project ON notes(project_id);
CREATE INDEX idx_notes_person ON notes(person_id) WHERE person_id IS NOT NULL;
CREATE INDEX idx_notes_organization ON notes(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX idx_notes_opportunity ON notes(opportunity_id) WHERE opportunity_id IS NOT NULL;
CREATE INDEX idx_notes_rfp ON notes(rfp_id) WHERE rfp_id IS NOT NULL;
CREATE INDEX idx_notes_created ON notes(created_at DESC);
CREATE INDEX idx_notes_pinned ON notes(is_pinned, created_at DESC) WHERE is_pinned = true;

-- Enable RLS
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view notes in their projects"
  ON notes FOR SELECT
  USING (
    project_id IN (
      SELECT project_id FROM project_memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create notes in their projects"
  ON notes FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT project_id FROM project_memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own notes"
  ON notes FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Users can delete their own notes or as admin"
  ON notes FOR DELETE
  USING (
    created_by = auth.uid() OR
    project_id IN (
      SELECT project_id FROM project_memberships
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );
