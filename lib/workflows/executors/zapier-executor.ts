/**
 * Zapier executor — invokes Zapier actions via MCP/SSE transport
 * Uses api_connections for credential management
 */

import { createClient } from '@supabase/supabase-js';
import type { WorkflowNode } from '@/types/workflow';
import { assertSafeUrl } from '@/lib/workflows/ssrf-guard';

interface ZapierResult {
  action: string;
  result: unknown;
  connection_id: string;
}

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function executeZapierAction(
  node: WorkflowNode,
  contextData: Record<string, unknown>,
  projectId: string
): Promise<ZapierResult> {
  const connectionId = node.data.config.connection_id as string;
  const action = node.data.config.action as string;
  const params = (node.data.config.params as Record<string, unknown>) || {};

  if (!connectionId) {
    throw new Error('Zapier connection ID is required');
  }

  if (!action) {
    throw new Error('Zapier action name is required');
  }

  // Load the connection credentials
  const supabase = createAdminClient();
  const { data: connection, error } = await supabase
    .from('api_connections')
    .select('*')
    .eq('id', connectionId)
    .eq('project_id', projectId)
    .eq('service_type', 'zapier')
    .eq('status', 'active')
    .single();

  if (error || !connection) {
    throw new Error(`Zapier connection not found or inactive: ${error?.message || 'not found'}`);
  }

  // Decrypt the stored credentials
  const { decrypt } = await import('@/lib/encryption');
  let config: { api_key?: string; server_url?: string };
  try {
    config = JSON.parse(decrypt(connection.config_enc));
  } catch {
    throw new Error('Failed to decrypt Zapier connection credentials');
  }

  const serverUrl = config.server_url || 'https://actions.zapier.com/mcp';
  const apiKey = config.api_key;

  if (!apiKey) {
    throw new Error('Zapier API key not found in connection config');
  }

  // Resolve context references in params
  const resolvedParams = resolveContextParams(params, contextData);

  assertSafeUrl(serverUrl);

  // Call Zapier MCP endpoint using JSON-RPC
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  let data: { error?: { message?: string }; result?: unknown } = {};
  try {
    const response = await fetch(serverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: action,
          arguments: resolvedParams,
        },
      }),
      signal: controller.signal,
      redirect: 'manual',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Zapier API returned ${response.status}: ${errorText}`);
    }

    data = await response.json();
  } finally {
    clearTimeout(timeout);
  }

  if (data.error) {
    throw new Error(`Zapier action error: ${data.error.message || JSON.stringify(data.error)}`);
  }

  // Update last_used_at on the connection
  await supabase
    .from('api_connections')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', connectionId);

  return {
    action,
    result: data.result ?? data,
    connection_id: connectionId,
  };
}

/**
 * Resolve {{path}} references in params using workflow context data
 */
function resolveContextParams(
  params: Record<string, unknown>,
  contextData: Record<string, unknown>
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') {
      resolved[key] = value.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
        const parts = path.trim().split('.');
        let current: unknown = contextData;
        for (const part of parts) {
          if (current && typeof current === 'object' && part in current) {
            current = (current as Record<string, unknown>)[part];
          } else {
            return `{{${path}}}`;
          }
        }
        return String(current ?? '');
      });
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      resolved[key] = resolveContextParams(value as Record<string, unknown>, contextData);
    } else {
      resolved[key] = value;
    }
  }

  return resolved;
}
