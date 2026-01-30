-- Sequence enrollments table
CREATE TABLE sequence_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  gmail_connection_id UUID NOT NULL REFERENCES gmail_connections(id) ON DELETE CASCADE,

  current_step INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'bounced', 'replied', 'unsubscribed')),

  next_send_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  reply_detected_at TIMESTAMPTZ,
  bounce_detected_at TIMESTAMPTZ,

  created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate enrollments
  UNIQUE(sequence_id, person_id)
);

-- Indexes
CREATE INDEX idx_sequence_enrollments_sequence ON sequence_enrollments(sequence_id);
CREATE INDEX idx_sequence_enrollments_person ON sequence_enrollments(person_id);
CREATE INDEX idx_sequence_enrollments_status ON sequence_enrollments(status);
CREATE INDEX idx_sequence_enrollments_next_send ON sequence_enrollments(next_send_at)
  WHERE status = 'active' AND next_send_at IS NOT NULL;

-- Enable RLS
ALTER TABLE sequence_enrollments ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view enrollments in their sequences"
  ON sequence_enrollments FOR SELECT
  USING (
    sequence_id IN (
      SELECT id FROM sequences WHERE project_id IN (
        SELECT project_id FROM project_memberships WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can create enrollments"
  ON sequence_enrollments FOR INSERT
  WITH CHECK (
    sequence_id IN (
      SELECT id FROM sequences WHERE project_id IN (
        SELECT project_id FROM project_memberships WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update enrollments"
  ON sequence_enrollments FOR UPDATE
  USING (
    sequence_id IN (
      SELECT id FROM sequences WHERE project_id IN (
        SELECT project_id FROM project_memberships WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete enrollments"
  ON sequence_enrollments FOR DELETE
  USING (
    sequence_id IN (
      SELECT id FROM sequences WHERE project_id IN (
        SELECT project_id FROM project_memberships WHERE user_id = auth.uid()
      )
    )
  );

-- Service role can update enrollments (for background processing)
CREATE POLICY "Service role can update any enrollment"
  ON sequence_enrollments FOR UPDATE
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Add sequence_enrollment_id reference to sent_emails
ALTER TABLE sent_emails
ADD COLUMN sequence_step_id UUID REFERENCES sequence_steps(id) ON DELETE SET NULL;

CREATE INDEX idx_sent_emails_sequence_step ON sent_emails(sequence_step_id)
  WHERE sequence_step_id IS NOT NULL;
