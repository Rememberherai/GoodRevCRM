-- MCP (Model Context Protocol) tables for enterprise MCP integration
-- Provides API key management, external server connections, tool configs, and usage logging

-- ============================================================================
-- mcp_api_keys: Project-scoped API keys for MCP authentication
-- ============================================================================
CREATE TABLE IF NOT EXISTS mcp_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  key_hash VARCHAR(64) NOT NULL UNIQUE,
  key_prefix VARCHAR(12) NOT NULL,
  key_encrypted TEXT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'member'
    CHECK (role IN ('viewer', 'member', 'admin', 'owner')),
  scopes JSONB DEFAULT '[]'::jsonb,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mcp_api_keys_project
  ON mcp_api_keys(project_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_mcp_api_keys_hash
  ON mcp_api_keys(key_hash);

ALTER TABLE mcp_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage MCP keys for their projects"
  ON mcp_api_keys FOR ALL
  USING (
    project_id IN (
      SELECT pm.project_id FROM project_memberships pm
      WHERE pm.user_id = auth.uid()
      AND pm.role IN ('owner', 'admin')
    )
  );

CREATE TRIGGER handle_mcp_api_keys_updated_at
  BEFORE UPDATE ON mcp_api_keys
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================================================================
-- mcp_external_servers: External MCP server connections per project
-- ============================================================================
CREATE TABLE IF NOT EXISTS mcp_external_servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  transport_type VARCHAR(20) NOT NULL DEFAULT 'http'
    CHECK (transport_type IN ('http', 'sse', 'stdio')),
  url TEXT NOT NULL,
  auth_config_enc TEXT,
  is_active BOOLEAN DEFAULT true,
  health_status VARCHAR(20) DEFAULT 'unknown'
    CHECK (health_status IN ('healthy', 'degraded', 'unhealthy', 'unknown')),
  last_health_check TIMESTAMPTZ,
  tool_manifest JSONB DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE mcp_external_servers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage MCP servers for their projects"
  ON mcp_external_servers FOR ALL
  USING (
    project_id IN (
      SELECT pm.project_id FROM project_memberships pm
      WHERE pm.user_id = auth.uid()
      AND pm.role IN ('owner', 'admin')
    )
  );

CREATE TRIGGER handle_mcp_external_servers_updated_at
  BEFORE UPDATE ON mcp_external_servers
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================================================================
-- mcp_tool_configs: Per-project tool enable/disable and rate limits
-- ============================================================================
CREATE TABLE IF NOT EXISTS mcp_tool_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tool_name VARCHAR(255) NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  rate_limit_per_minute INT DEFAULT 60,
  rate_limit_per_hour INT DEFAULT 1000,
  min_role VARCHAR(20)
    CHECK (min_role IS NULL OR min_role IN ('viewer', 'member', 'admin', 'owner')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, tool_name)
);

ALTER TABLE mcp_tool_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage MCP tool configs for their projects"
  ON mcp_tool_configs FOR ALL
  USING (
    project_id IN (
      SELECT pm.project_id FROM project_memberships pm
      WHERE pm.user_id = auth.uid()
      AND pm.role IN ('owner', 'admin')
    )
  );

CREATE TRIGGER handle_mcp_tool_configs_updated_at
  BEFORE UPDATE ON mcp_tool_configs
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================================================================
-- mcp_usage_logs: Audit log for all MCP tool invocations
-- ============================================================================
CREATE TABLE IF NOT EXISTS mcp_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  api_key_id UUID REFERENCES mcp_api_keys(id) ON DELETE SET NULL,
  tool_name VARCHAR(255) NOT NULL,
  input_summary JSONB,
  output_summary TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'success'
    CHECK (status IN ('success', 'error', 'rate_limited', 'unauthorized')),
  error_message TEXT,
  duration_ms INT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mcp_usage_logs_project
  ON mcp_usage_logs(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mcp_usage_logs_key
  ON mcp_usage_logs(api_key_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mcp_usage_logs_tool
  ON mcp_usage_logs(tool_name, created_at DESC);

ALTER TABLE mcp_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view MCP usage logs for their projects"
  ON mcp_usage_logs FOR SELECT
  USING (
    project_id IN (
      SELECT pm.project_id FROM project_memberships pm
      WHERE pm.user_id = auth.uid()
    )
  );
