import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getCommunityToolCatalog } from '@/lib/chat/community-tool-registry';
import type { McpContext } from '@/types/mcp';
import type { CommunityChatTool } from '@/lib/chat/community-tool-registry';

const CONTRACTOR_PREFIXES = new Set([
  'contractors',
  'jobs',
  'calendar',
  'receipts',
]);

function getToolShape(tool: CommunityChatTool) {
  return (tool.parameters as unknown as { shape: Record<string, unknown> }).shape;
}

export function registerCommunityContractorTools(server: McpServer, getContext: () => McpContext) {
  const tools = getCommunityToolCatalog(getContext().role)
    .filter((tool) => CONTRACTOR_PREFIXES.has(tool.name.split('.')[0] ?? ''));

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
