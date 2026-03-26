import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getCommunityToolCatalog } from '@/lib/chat/community-tool-registry';
import type { McpContext } from '@/types/mcp';
import type { CommunityChatTool } from '@/lib/chat/community-tool-registry';

const CORE_PREFIXES = new Set([
  'households',
  'programs',
  'contributions',
  'assets',
  'referrals',
  'relationships',
  'broadcasts',
  'grants',
  'census',
  'events',
]);

function getToolShape(tool: CommunityChatTool) {
  return (tool.parameters as unknown as { shape: Record<string, unknown> }).shape;
}

export function registerCommunityTools(server: McpServer, getContext: () => McpContext) {
  const tools = getCommunityToolCatalog(getContext().role)
    .filter((tool) => CORE_PREFIXES.has(tool.name.split('.')[0] ?? ''));

  for (const tool of tools) {
    server.tool(
      tool.name,
      tool.description,
      getToolShape(tool),
      async (params) => {
        try {
          const result = await tool.handler(params as Record<string, unknown>, getContext());
          return {
            content: [{ type: 'text' as const, text: result }],
          };
        } catch (err) {
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ error: err instanceof Error ? err.message : 'Tool execution failed' }) }],
            isError: true,
          };
        }
      }
    );
  }
}
