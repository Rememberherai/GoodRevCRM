import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database';
import type { ProjectRole, StandardProjectRole } from './user';
import type { ProjectType } from './project';

// RBAC roles in order of privilege
export const STANDARD_MCP_ROLES = [
  'viewer',
  'member',
  'admin',
  'owner',
] as const;

export const COMMUNITY_MCP_ROLES = [
  'owner',
  'admin',
  'staff',
  'case_manager',
  'contractor',
  'board_viewer',
] as const;

export const MCP_ROLES = [
  ...STANDARD_MCP_ROLES,
  'staff',
  'case_manager',
  'contractor',
  'board_viewer',
] as const;
export type McpRole = ProjectRole;
export type StandardMcpRole = StandardProjectRole;

const MCP_ROLE_SET = new Set<string>(MCP_ROLES);
const STANDARD_MCP_ROLE_SET = new Set<string>(STANDARD_MCP_ROLES);

export function isMcpRole(role: string): role is McpRole {
  return MCP_ROLE_SET.has(role);
}

export function isStandardMcpRole(role: string): role is StandardMcpRole {
  return STANDARD_MCP_ROLE_SET.has(role);
}

// Context passed to every MCP tool handler
export interface McpContext {
  projectId: string;
  projectType: ProjectType;
  userId: string;
  role: McpRole;
  apiKeyId: string;
  supabase: SupabaseClient<Database>;
}

// API key row from database
export interface McpApiKey {
  id: string;
  project_id: string;
  name: string;
  key_hash: string;
  key_prefix: string;
  key_encrypted: string;
  role: McpRole;
  scopes: string[];
  created_by: string;
  expires_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
}

// Tool definition metadata
export interface McpToolDef {
  name: string;
  description: string;
  minRole: StandardMcpRole;
  category: string;
}

// Usage log entry
export interface McpUsageLog {
  tool_name: string;
  input_summary: Record<string, unknown> | null;
  output_summary: string | null;
  status: 'success' | 'error' | 'rate_limited' | 'unauthorized';
  error_message: string | null;
  duration_ms: number | null;
}

// Rate limit state
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: Date;
}
