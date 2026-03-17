import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database';

// RBAC roles in order of privilege
export const MCP_ROLES = ['viewer', 'member', 'admin', 'owner'] as const;
export type McpRole = (typeof MCP_ROLES)[number];

// Context passed to every MCP tool handler
export interface McpContext {
  projectId: string;
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
  minRole: McpRole;
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
