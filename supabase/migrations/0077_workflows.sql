-- Migration: 20260317000000_workflows.sql
-- Description: Enterprise workflow management system — visual DAG-based workflows
-- with branching, sub-flows, AI agent nodes, MCP tool integration, and external connections.

-- ============================================================================
-- workflows: Core workflow definitions (per-project)
-- ============================================================================
CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  is_template BOOLEAN NOT NULL DEFAULT false,
  trigger_type VARCHAR(50) NOT NULL DEFAULT 'manual',
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  definition JSONB NOT NULL DEFAULT '{"schema_version":"1.0.0","nodes":[],"edges":[]}'::jsonb,
  current_version INT NOT NULL DEFAULT 1,
  execution_count INT NOT NULL DEFAULT 0,
  last_executed_at TIMESTAMPTZ,
  tags TEXT[] DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflows_project_active
  ON workflows(project_id, is_active);
CREATE INDEX IF NOT EXISTS idx_workflows_project_trigger
  ON workflows(project_id, trigger_type) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_workflows_template
  ON workflows(is_template) WHERE is_template = true;
CREATE INDEX IF NOT EXISTS idx_workflows_tags
  ON workflows USING GIN (tags);

-- ============================================================================
-- workflow_versions: Version history (every save creates a version)
-- ============================================================================
CREATE TABLE IF NOT EXISTS workflow_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  version INT NOT NULL,
  definition JSONB NOT NULL,
  trigger_type VARCHAR(50) NOT NULL,
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  change_summary TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT workflow_versions_unique UNIQUE (workflow_id, version)
);

CREATE INDEX IF NOT EXISTS idx_workflow_versions_workflow
  ON workflow_versions(workflow_id, version DESC);

-- ============================================================================
-- workflow_executions: One per workflow run
-- ============================================================================
CREATE TABLE IF NOT EXISTS workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  workflow_version INT NOT NULL,
  trigger_event JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed', 'cancelled', 'paused')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  entity_type VARCHAR(50),
  entity_id UUID,
  context_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow
  ON workflow_executions(workflow_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status
  ON workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_entity
  ON workflow_executions(entity_type, entity_id);

-- ============================================================================
-- workflow_step_executions: Per-node execution tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS workflow_step_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
  node_id VARCHAR(255) NOT NULL,
  node_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped', 'waiting')),
  input_data JSONB,
  output_data JSONB,
  error_message TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_step_executions_execution
  ON workflow_step_executions(execution_id, created_at);
CREATE INDEX IF NOT EXISTS idx_workflow_step_executions_status
  ON workflow_step_executions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_step_executions_delayed
  ON workflow_step_executions(scheduled_for)
  WHERE status = 'waiting' AND scheduled_for IS NOT NULL;

-- ============================================================================
-- api_connections: External service credentials (Zapier, webhooks, custom APIs)
-- ============================================================================
CREATE TABLE IF NOT EXISTS api_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  service_type VARCHAR(20) NOT NULL
    CHECK (service_type IN ('zapier', 'webhook', 'oauth2', 'api_key', 'mcp')),
  config_enc TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'expired', 'error')),
  last_used_at TIMESTAMPTZ,
  last_health_check TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_connections_project
  ON api_connections(project_id, status);

-- ============================================================================
-- RLS: workflows
-- ============================================================================
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view workflows in their projects"
  ON workflows FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_memberships
      WHERE project_memberships.project_id = workflows.project_id
        AND project_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can create workflows"
  ON workflows FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_memberships
      WHERE project_memberships.project_id = workflows.project_id
        AND project_memberships.user_id = auth.uid()
        AND project_memberships.role IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY "Members can update workflows"
  ON workflows FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM project_memberships
      WHERE project_memberships.project_id = workflows.project_id
        AND project_memberships.user_id = auth.uid()
        AND project_memberships.role IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY "Admins can delete workflows"
  ON workflows FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM project_memberships
      WHERE project_memberships.project_id = workflows.project_id
        AND project_memberships.user_id = auth.uid()
        AND project_memberships.role IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- RLS: workflow_versions
-- ============================================================================
ALTER TABLE workflow_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view workflow versions in their projects"
  ON workflow_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workflows
      JOIN project_memberships ON project_memberships.project_id = workflows.project_id
      WHERE workflows.id = workflow_versions.workflow_id
        AND project_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage workflow versions"
  ON workflow_versions FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- RLS: workflow_executions
-- ============================================================================
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view workflow executions in their projects"
  ON workflow_executions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workflows
      JOIN project_memberships ON project_memberships.project_id = workflows.project_id
      WHERE workflows.id = workflow_executions.workflow_id
        AND project_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage workflow executions"
  ON workflow_executions FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- RLS: workflow_step_executions
-- ============================================================================
ALTER TABLE workflow_step_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view step executions in their projects"
  ON workflow_step_executions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workflow_executions
      JOIN workflows ON workflows.id = workflow_executions.workflow_id
      JOIN project_memberships ON project_memberships.project_id = workflows.project_id
      WHERE workflow_executions.id = workflow_step_executions.execution_id
        AND project_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage step executions"
  ON workflow_step_executions FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- RLS: api_connections
-- ============================================================================
ALTER TABLE api_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view api connections in their projects"
  ON api_connections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_memberships
      WHERE project_memberships.project_id = api_connections.project_id
        AND project_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage api connections"
  ON api_connections FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM project_memberships
      WHERE project_memberships.project_id = api_connections.project_id
        AND project_memberships.user_id = auth.uid()
        AND project_memberships.role IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- Triggers: updated_at
-- ============================================================================
CREATE TRIGGER handle_workflows_updated_at
  BEFORE UPDATE ON workflows
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER handle_api_connections_updated_at
  BEFORE UPDATE ON api_connections
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================================================================
-- RPC: Log workflow execution and update counters
-- ============================================================================
CREATE OR REPLACE FUNCTION log_workflow_execution(
  p_workflow_id UUID,
  p_workflow_version INT,
  p_trigger_event JSONB,
  p_status VARCHAR(20),
  p_error_message TEXT DEFAULT NULL,
  p_entity_type VARCHAR(50) DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_execution_id UUID;
BEGIN
  INSERT INTO workflow_executions (
    workflow_id, workflow_version, trigger_event,
    status, error_message, entity_type, entity_id
  )
  VALUES (
    p_workflow_id, p_workflow_version, p_trigger_event,
    p_status, p_error_message, p_entity_type, p_entity_id
  )
  RETURNING id INTO v_execution_id;

  UPDATE workflows
  SET execution_count = execution_count + 1,
      last_executed_at = NOW()
  WHERE id = p_workflow_id;

  RETURN v_execution_id;
END;
$$;

-- ============================================================================
-- RPC: Get active workflows for a trigger event
-- ============================================================================
CREATE OR REPLACE FUNCTION get_workflows_for_trigger(
  p_project_id UUID,
  p_trigger_type VARCHAR(50)
)
RETURNS TABLE (
  id UUID,
  name VARCHAR(100),
  trigger_type VARCHAR(50),
  trigger_config JSONB,
  definition JSONB,
  current_version INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    w.id,
    w.name,
    w.trigger_type,
    w.trigger_config,
    w.definition,
    w.current_version
  FROM workflows w
  WHERE w.project_id = p_project_id
    AND w.is_active = true
    AND w.trigger_type = p_trigger_type;
END;
$$;
