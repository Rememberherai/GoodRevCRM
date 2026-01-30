-- Sequence steps table
CREATE TABLE sequence_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  step_type TEXT NOT NULL CHECK (step_type IN ('email', 'delay', 'condition')),

  -- Email step fields
  subject TEXT,
  body_html TEXT,
  body_text TEXT,

  -- Delay step fields
  delay_amount INTEGER,
  delay_unit TEXT CHECK (delay_unit IN ('minutes', 'hours', 'days', 'weeks')),

  -- Condition step fields
  condition JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure unique step numbers per sequence
  UNIQUE(sequence_id, step_number)
);

-- Indexes
CREATE INDEX idx_sequence_steps_sequence ON sequence_steps(sequence_id);
CREATE INDEX idx_sequence_steps_order ON sequence_steps(sequence_id, step_number);

-- Enable RLS
ALTER TABLE sequence_steps ENABLE ROW LEVEL SECURITY;

-- RLS policies (inherit from sequences)
CREATE POLICY "Users can view steps in their sequences"
  ON sequence_steps FOR SELECT
  USING (
    sequence_id IN (
      SELECT id FROM sequences WHERE project_id IN (
        SELECT project_id FROM project_memberships WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can create steps in their sequences"
  ON sequence_steps FOR INSERT
  WITH CHECK (
    sequence_id IN (
      SELECT id FROM sequences WHERE project_id IN (
        SELECT project_id FROM project_memberships WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update steps in their sequences"
  ON sequence_steps FOR UPDATE
  USING (
    sequence_id IN (
      SELECT id FROM sequences WHERE project_id IN (
        SELECT project_id FROM project_memberships WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete steps in their sequences"
  ON sequence_steps FOR DELETE
  USING (
    sequence_id IN (
      SELECT id FROM sequences WHERE project_id IN (
        SELECT project_id FROM project_memberships WHERE user_id = auth.uid()
      )
    )
  );
