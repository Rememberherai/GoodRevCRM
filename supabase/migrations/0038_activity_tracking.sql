-- ============================================================================
-- Enterprise Activity Tracking + Meetings System
-- Extends activity_log for manual CRM activity logging with outcomes,
-- follow-ups, and entity linking. Adds meetings as a first-class entity.
-- ============================================================================

-- ============================================================================
-- PART 1: Extend activity_log table
-- ============================================================================

-- Entity linking columns (activity can be linked to multiple entities)
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES people(id) ON DELETE SET NULL;
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL;
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS rfp_id UUID REFERENCES rfps(id) ON DELETE SET NULL;

-- CRM activity fields
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS activity_type TEXT CHECK (activity_type IN (
  'call', 'email', 'meeting', 'note', 'task', 'sequence_completed', 'system'
));
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS outcome TEXT CHECK (outcome IN (
  'call_no_answer', 'call_left_message', 'quality_conversation', 'meeting_booked',
  'email_sent', 'email_opened', 'email_replied', 'proposal_sent',
  'follow_up_scheduled', 'not_interested', 'other'
));
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS direction TEXT CHECK (direction IN ('inbound', 'outbound'));
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;

-- Follow-up linking
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS follow_up_date TIMESTAMPTZ;
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS follow_up_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL;

-- Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_activity_log_person ON activity_log(person_id) WHERE person_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activity_log_organization ON activity_log(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activity_log_opportunity ON activity_log(opportunity_id) WHERE opportunity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activity_log_rfp ON activity_log(rfp_id) WHERE rfp_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activity_log_activity_type ON activity_log(activity_type) WHERE activity_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activity_log_follow_up ON activity_log(follow_up_date) WHERE follow_up_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activity_log_project_person ON activity_log(project_id, person_id) WHERE person_id IS NOT NULL;

-- ============================================================================
-- PART 2: Add source_activity_id to tasks for bidirectional linking
-- ============================================================================

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source_activity_id UUID REFERENCES activity_log(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_source_activity ON tasks(source_activity_id) WHERE source_activity_id IS NOT NULL;

-- ============================================================================
-- PART 3: Meetings table
-- ============================================================================

CREATE TABLE IF NOT EXISTS meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- Core fields
  title TEXT NOT NULL,
  description TEXT,
  meeting_type TEXT NOT NULL DEFAULT 'general' CHECK (meeting_type IN (
    'discovery', 'demo', 'proposal_review', 'negotiation', 'onboarding',
    'check_in', 'qbr', 'general'
  )),

  -- Scheduling
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  location TEXT,
  meeting_url TEXT,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN (
    'scheduled', 'confirmed', 'attended', 'no_show', 'rescheduled', 'cancelled'
  )),
  status_changed_at TIMESTAMPTZ,

  -- Rescheduling tracking
  rescheduled_from TIMESTAMPTZ,
  reschedule_count INTEGER DEFAULT 0,
  cancellation_reason TEXT,

  -- Outcome (filled after meeting)
  outcome TEXT CHECK (outcome IN (
    'positive', 'neutral', 'negative', 'follow_up_needed', 'deal_advanced', 'no_outcome'
  )),
  outcome_notes TEXT,
  next_steps TEXT,

  -- Entity linking
  person_id UUID REFERENCES people(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  rfp_id UUID REFERENCES rfps(id) ON DELETE SET NULL,

  -- Ownership
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Meetings indexes
CREATE INDEX IF NOT EXISTS idx_meetings_project ON meetings(project_id);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);
CREATE INDEX IF NOT EXISTS idx_meetings_scheduled ON meetings(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_meetings_person ON meetings(person_id) WHERE person_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_meetings_organization ON meetings(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_meetings_opportunity ON meetings(opportunity_id) WHERE opportunity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_meetings_project_status_scheduled ON meetings(project_id, status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_meetings_assigned ON meetings(assigned_to) WHERE assigned_to IS NOT NULL;

-- Meetings RLS
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view meetings in their projects"
  ON meetings FOR SELECT
  USING (
    project_id IN (
      SELECT project_id FROM project_memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create meetings in their projects"
  ON meetings FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT project_id FROM project_memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update meetings in their projects"
  ON meetings FOR UPDATE
  USING (
    project_id IN (
      SELECT project_id FROM project_memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete meetings they created or as admin"
  ON meetings FOR DELETE
  USING (
    created_by = auth.uid() OR
    project_id IN (
      SELECT project_id FROM project_memberships
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- PART 4: Meeting attendees junction table
-- ============================================================================

CREATE TABLE IF NOT EXISTS meeting_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  person_id UUID REFERENCES people(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  attendance_status TEXT DEFAULT 'pending' CHECK (attendance_status IN (
    'pending', 'accepted', 'declined', 'tentative', 'attended', 'no_show'
  )),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraints (allow NULL in one of person_id/user_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_meeting_attendees_person ON meeting_attendees(meeting_id, person_id) WHERE person_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_meeting_attendees_user ON meeting_attendees(meeting_id, user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_meeting_attendees_meeting ON meeting_attendees(meeting_id);

-- Meeting attendees RLS
ALTER TABLE meeting_attendees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view meeting attendees for their project meetings"
  ON meeting_attendees FOR SELECT
  USING (
    meeting_id IN (
      SELECT id FROM meetings WHERE project_id IN (
        SELECT project_id FROM project_memberships WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage meeting attendees for their project meetings"
  ON meeting_attendees FOR INSERT
  WITH CHECK (
    meeting_id IN (
      SELECT id FROM meetings WHERE project_id IN (
        SELECT project_id FROM project_memberships WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update meeting attendees for their project meetings"
  ON meeting_attendees FOR UPDATE
  USING (
    meeting_id IN (
      SELECT id FROM meetings WHERE project_id IN (
        SELECT project_id FROM project_memberships WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete meeting attendees for their project meetings"
  ON meeting_attendees FOR DELETE
  USING (
    meeting_id IN (
      SELECT id FROM meetings WHERE project_id IN (
        SELECT project_id FROM project_memberships WHERE user_id = auth.uid()
      )
    )
  );
