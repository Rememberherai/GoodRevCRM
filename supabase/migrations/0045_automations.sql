-- Migration: 0044_automations.sql
-- Description: Workflow automation engine - triggers, conditions, actions

-- Automations table (one row per automation rule)
CREATE TABLE IF NOT EXISTS automations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  trigger_type VARCHAR(50) NOT NULL,
  trigger_config JSONB NOT NULL DEFAULT '{}'::JSONB,
  conditions JSONB NOT NULL DEFAULT '[]'::JSONB,
  actions JSONB NOT NULL DEFAULT '[]'::JSONB,
  execution_count INTEGER NOT NULL DEFAULT 0,
  last_executed_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Automation executions log
CREATE TABLE IF NOT EXISTS automation_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  trigger_event JSONB NOT NULL,
  conditions_met BOOLEAN NOT NULL DEFAULT false,
  actions_results JSONB NOT NULL DEFAULT '[]'::JSONB,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  error_message TEXT,
  duration_ms INTEGER,
  entity_type VARCHAR(50),
  entity_id UUID,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Time-based trigger deduplication
CREATE TABLE IF NOT EXISTS automation_time_checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_matched_entity_ids JSONB NOT NULL DEFAULT '[]'::JSONB,
  CONSTRAINT automation_time_checks_automation_id_key UNIQUE (automation_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_automations_project_active ON automations(project_id, is_active);
CREATE INDEX IF NOT EXISTS idx_automations_trigger_type ON automations(trigger_type);
CREATE INDEX IF NOT EXISTS idx_automations_project_trigger ON automations(project_id, trigger_type) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_automation_executions_automation ON automation_executions(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_executions_executed_at ON automation_executions(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_executions_entity ON automation_executions(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_automation_executions_status ON automation_executions(status);

-- RLS for automations
ALTER TABLE automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view automations in their projects"
  ON automations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_memberships
      WHERE project_memberships.project_id = automations.project_id
        AND project_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage automations"
  ON automations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM project_memberships
      WHERE project_memberships.project_id = automations.project_id
        AND project_memberships.user_id = auth.uid()
        AND project_memberships.role IN ('owner', 'admin')
    )
  );

-- RLS for automation_executions
ALTER TABLE automation_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view automation executions in their projects"
  ON automation_executions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM automations
      JOIN project_memberships ON project_memberships.project_id = automations.project_id
      WHERE automations.id = automation_executions.automation_id
        AND project_memberships.user_id = auth.uid()
    )
  );

-- Service role can manage executions (for background processor)
CREATE POLICY "Service role can manage automation executions"
  ON automation_executions FOR ALL
  USING (auth.role() = 'service_role');

-- RLS for automation_time_checks
ALTER TABLE automation_time_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage automation time checks"
  ON automation_time_checks FOR ALL
  USING (auth.role() = 'service_role');

-- Function to get active automations for a trigger event
CREATE OR REPLACE FUNCTION get_automations_for_trigger(
  p_project_id UUID,
  p_trigger_type VARCHAR(50)
)
RETURNS TABLE (
  id UUID,
  name VARCHAR(255),
  trigger_type VARCHAR(50),
  trigger_config JSONB,
  conditions JSONB,
  actions JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.name,
    a.trigger_type,
    a.trigger_config,
    a.conditions,
    a.actions
  FROM automations a
  WHERE a.project_id = p_project_id
    AND a.is_active = true
    AND a.trigger_type = p_trigger_type;
END;
$$;

-- Function to log an automation execution and update counters
CREATE OR REPLACE FUNCTION log_automation_execution(
  p_automation_id UUID,
  p_trigger_event JSONB,
  p_conditions_met BOOLEAN,
  p_actions_results JSONB,
  p_status VARCHAR(50),
  p_error_message TEXT,
  p_duration_ms INTEGER,
  p_entity_type VARCHAR(50),
  p_entity_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_execution_id UUID;
BEGIN
  -- Insert execution log
  INSERT INTO automation_executions (
    automation_id, trigger_event, conditions_met, actions_results,
    status, error_message, duration_ms, entity_type, entity_id
  )
  VALUES (
    p_automation_id, p_trigger_event, p_conditions_met, p_actions_results,
    p_status, p_error_message, p_duration_ms, p_entity_type, p_entity_id
  )
  RETURNING id INTO v_execution_id;

  -- Update automation counters
  UPDATE automations
  SET execution_count = execution_count + 1,
      last_executed_at = NOW()
  WHERE id = p_automation_id;

  RETURN v_execution_id;
END;
$$;

-- Updated_at trigger
CREATE TRIGGER update_automations_updated_at
  BEFORE UPDATE ON automations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
