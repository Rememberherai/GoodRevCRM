import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { isMcpRole, isStandardMcpRole, type McpContext, type McpRole, type StandardMcpRole } from '@/types/mcp';

const ROLE_HIERARCHY: Record<StandardMcpRole, number> = {
  viewer: 0,
  member: 1,
  admin: 2,
  owner: 3,
};

/**
 * Check if the authenticated role meets the minimum required role.
 * Throws if insufficient permissions.
 */
export function checkPermission(currentRole: McpRole, requiredRole: StandardMcpRole): void {
  if (!isStandardMcpRole(currentRole)) {
    throw new Error(`Role '${currentRole}' is not supported by the legacy MCP/chat tool registry`);
  }

  if (ROLE_HIERARCHY[currentRole] < ROLE_HIERARCHY[requiredRole]) {
    throw new Error(
      `Insufficient permissions: requires '${requiredRole}' role, but key has '${currentRole}'`
    );
  }
}

/**
 * Hash an API key for lookup (SHA-256).
 */
export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Generate a new MCP API key with prefix.
 */
export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const random = crypto.randomBytes(32).toString('hex');
  const key = `grv_${random}`;
  const prefix = `grv_${random.slice(0, 8)}`;
  const hash = hashApiKey(key);
  return { key, prefix, hash };
}

/**
 * Authenticate an MCP request using a Bearer token.
 * Returns the MCP context or null if authentication fails.
 */
export async function authenticateApiKey(
  bearerToken: string
): Promise<McpContext | null> {
  if (!bearerToken.startsWith('grv_')) {
    return null;
  }

  const keyHash = hashApiKey(bearerToken);
  const supabase = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- MCP tables not yet in generated types
  const db = supabase as any;

  const { data: apiKey, error } = await db
    .from('mcp_api_keys')
    .select('*')
    .eq('key_hash', keyHash)
    .is('revoked_at', null)
    .single();

  if (error || !apiKey) {
    return null;
  }
  if (!isMcpRole(apiKey.role)) {
    return null;
  }

  // Check expiry
  if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
    return null;
  }

  // Update last_used_at (fire-and-forget)
  db
    .from('mcp_api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', apiKey.id)
    .then(() => {})
    .catch((err: Error) => {
      console.error('[MCP] Failed to update last_used_at:', err.message);
    });

  return {
    projectId: apiKey.project_id as string,
    userId: apiKey.created_by as string,
    role: apiKey.role,
    apiKeyId: apiKey.id as string,
    supabase,
  };
}
