/**
 * MCP tool executor — invokes MCP tools from workflow nodes
 * Supports 3 modes matching cc-wf-studio:
 *   - manual: explicit server/tool/params
 *   - ai_params: user selects tool, AI interprets natural language params
 *   - ai_selection: AI chooses the tool based on task description
 */

import { createClient } from '@supabase/supabase-js';
import type { WorkflowNode, McpNodeMode } from '@/types/workflow';
import { assertSafeUrl } from '@/lib/workflows/ssrf-guard';

interface McpToolResult {
  mode: McpNodeMode;
  tool_name: string;
  result: unknown;
}

function safeJsonParse(str: string): unknown {
  try {
    return JSON.parse(str);
  } catch {
    return { raw: str };
  }
}

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function executeMcpTool(
  node: WorkflowNode,
  contextData: Record<string, unknown>,
  projectId: string
): Promise<McpToolResult> {
  const mode = (node.data.config.mode as McpNodeMode) || 'manual';
  const toolName = node.data.config.tool_name as string;
  const serverUrl = node.data.config.server_url as string;
  const params = (node.data.config.params as Record<string, unknown>) || {};

  switch (mode) {
    case 'manual':
      return executeManual(toolName, serverUrl, params, contextData, projectId);

    case 'ai_params':
      return executeAiParams(toolName, serverUrl, node.data.config, contextData, projectId);

    case 'ai_selection':
      return executeAiSelection(node.data.config, contextData, projectId);

    default:
      throw new Error(`Unknown MCP mode: ${mode}`);
  }
}

/**
 * Manual mode: call the specified tool with explicit params
 */
async function executeManual(
  toolName: string,
  serverUrl: string,
  params: Record<string, unknown>,
  contextData: Record<string, unknown>,
  projectId: string
): Promise<McpToolResult> {
  if (!toolName) throw new Error('MCP tool name is required in manual mode');

  // Resolve context references in params (e.g. {{entity_name}})
  const resolvedParams = resolveParams(params, contextData);

  // Check if this is an internal tool (our MCP server) or external
  if (!serverUrl || serverUrl === 'internal') {
    return executeInternalTool(toolName, resolvedParams, projectId);
  }

  return executeExternalTool(serverUrl, toolName, resolvedParams, projectId);
}

/**
 * AI Params mode: user selected the tool, AI interprets natural language to structured params
 */
async function executeAiParams(
  toolName: string,
  serverUrl: string,
  config: Record<string, unknown>,
  contextData: Record<string, unknown>,
  projectId: string
): Promise<McpToolResult> {
  if (!toolName) throw new Error('MCP tool name is required in ai_params mode');

  const taskDescription = (config.task_description as string) || '';

  // Use OpenRouter to convert natural language to tool params
  const aiResponse = await callOpenRouter(
    `You are a tool parameter resolver. Given a tool name and a task description, generate the JSON parameters needed to call this tool.

Tool: ${toolName}
Task: ${taskDescription}
Available context data: ${JSON.stringify(contextData, null, 2)}

Respond with ONLY a valid JSON object of the parameters. No explanation.`,
    projectId
  );

  let resolvedParams: Record<string, unknown> = {};
  try {
    resolvedParams = JSON.parse(aiResponse);
  } catch {
    resolvedParams = { raw_input: aiResponse };
  }

  if (!serverUrl || serverUrl === 'internal') {
    return executeInternalTool(toolName, resolvedParams, projectId);
  }

  return executeExternalTool(serverUrl, toolName, resolvedParams, projectId);
}

/**
 * AI Selection mode: AI chooses the best tool and params based on task description
 */
async function executeAiSelection(
  config: Record<string, unknown>,
  contextData: Record<string, unknown>,
  projectId: string
): Promise<McpToolResult> {
  const taskDescription = (config.task_description as string) || '';

  // Get available tools from our MCP server
  const supabase = createAdminClient();
  const { data: mcpServers } = await supabase
    .from('mcp_external_servers')
    .select('name, tool_manifest')
    .eq('project_id', projectId)
    .eq('is_active', true);

  const availableTools = (mcpServers || [])
    .flatMap((s) => {
      const manifest = s.tool_manifest as { tools?: { name: string; description: string }[] };
      return (manifest?.tools || []).map((t) => `${s.name}/${t.name}: ${t.description}`);
    })
    .join('\n');

  const aiResponse = await callOpenRouter(
    `You are a tool selection AI. Given a task and available tools, choose the best tool and generate its parameters.

Task: ${taskDescription}
Context: ${JSON.stringify(contextData, null, 2)}

Available tools:
${availableTools || 'No external tools available. Use internal CRM tools (organizations.list, people.list, opportunities.list, etc.)'}

Respond with JSON: { "tool_name": "...", "params": { ... } }`,
    projectId
  );

  let selection: { tool_name: string; params: Record<string, unknown> };
  try {
    selection = JSON.parse(aiResponse);
  } catch {
    throw new Error(`AI failed to select a tool: ${aiResponse}`);
  }

  return executeInternalTool(selection.tool_name, selection.params, projectId);
}

/**
 * Execute a tool from our internal MCP server
 */
async function executeInternalTool(
  toolName: string,
  params: Record<string, unknown>,
  projectId: string
): Promise<McpToolResult> {
  // Dynamic import to avoid circular deps
  const { executeTool } = await import('@/lib/chat/tool-registry');
  const { createClient: createSupaClient } = await import('@supabase/supabase-js');

  const supabase = createSupaClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const result = await executeTool(toolName, params, {
    supabase,
    projectId,
    userId: 'system',
    role: 'admin',
    apiKeyId: 'workflow-internal',
  });

  return {
    mode: 'manual',
    tool_name: toolName,
    result: typeof result === 'string' ? safeJsonParse(result) : result,
  };
}

/**
 * Execute a tool on an external MCP server via HTTP
 */
async function executeExternalTool(
  serverUrl: string,
  toolName: string,
  params: Record<string, unknown>,
  projectId: string
): Promise<McpToolResult> {
  // Look up MCP connection credentials by service type
  const supabase = createAdminClient();
  const { data: connections } = await supabase
    .from('api_connections')
    .select('config_enc')
    .eq('project_id', projectId)
    .eq('service_type', 'mcp')
    .eq('status', 'active');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Find the connection whose decrypted config contains this server URL
  if (connections?.length) {
    const { decrypt } = await import('@/lib/encryption');
    for (const conn of connections) {
      try {
        const config = JSON.parse(decrypt(conn.config_enc));
        if (config.server_url === serverUrl && config.api_key) {
          headers['Authorization'] = `Bearer ${config.api_key}`;
          break;
        }
      } catch {
        // Skip connections that can't be decrypted
      }
    }
  }

  assertSafeUrl(serverUrl);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  let data: { error?: { message?: string }; result?: unknown };
  try {
    const response = await fetch(serverUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: toolName, arguments: params },
      }),
      signal: controller.signal,
      redirect: 'manual',
    });

    if (!response.ok) {
      throw new Error(`MCP server returned ${response.status}: ${response.statusText}`);
    }

    data = await response.json();
  } finally {
    clearTimeout(timeout);
  }
  if (data.error) {
    throw new Error(`MCP tool error: ${data.error.message || JSON.stringify(data.error)}`);
  }

  return {
    mode: 'manual',
    tool_name: toolName,
    result: data.result,
  };
}

/**
 * Resolve {{context.path}} references in params
 */
function resolveParams(
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
    } else {
      resolved[key] = value;
    }
  }
  return resolved;
}

/**
 * Call OpenRouter API for AI-assisted param resolution / tool selection
 */
async function callOpenRouter(prompt: string, _projectId: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not configured');

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}
