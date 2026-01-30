-- Tasks table for Phase 14
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),

  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Entity associations (polymorphic)
  person_id UUID REFERENCES people(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  rfp_id UUID REFERENCES rfps(id) ON DELETE SET NULL,

  -- Assignment
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_assigned ON tasks(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_tasks_due ON tasks(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX idx_tasks_person ON tasks(person_id) WHERE person_id IS NOT NULL;
CREATE INDEX idx_tasks_organization ON tasks(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX idx_tasks_opportunity ON tasks(opportunity_id) WHERE opportunity_id IS NOT NULL;
CREATE INDEX idx_tasks_rfp ON tasks(rfp_id) WHERE rfp_id IS NOT NULL;

-- Enable RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view tasks in their projects"
  ON tasks FOR SELECT
  USING (
    project_id IN (
      SELECT project_id FROM project_memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create tasks in their projects"
  ON tasks FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT project_id FROM project_memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update tasks in their projects"
  ON tasks FOR UPDATE
  USING (
    project_id IN (
      SELECT project_id FROM project_memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own tasks or as admin"
  ON tasks FOR DELETE
  USING (
    created_by = auth.uid() OR
    project_id IN (
      SELECT project_id FROM project_memberships
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );
