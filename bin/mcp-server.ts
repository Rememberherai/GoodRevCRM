#!/usr/bin/env tsx
/**
 * GoodRev CRM MCP Server — stdio transport
 *
 * For use with Claude Desktop, Cursor, and other MCP clients
 * that connect via stdio (stdin/stdout).
 *
 * Usage:
 *   MCP_API_KEY=grv_xxxx npx tsx bin/mcp-server.ts
 *
 * Claude Desktop config (~/.claude/claude_desktop_config.json):
 *   {
 *     "mcpServers": {
 *       "goodrev": {
 *         "command": "npx",
 *         "args": ["tsx", "bin/mcp-server.ts"],
 *         "cwd": "/path/to/GoodRevCRM",
 *         "env": { "MCP_API_KEY": "grv_xxxx" }
 *       }
 *     }
 *   }
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpServer } from '../lib/mcp/server';
import { authenticateApiKey } from '../lib/mcp/auth';

async function main() {
  const apiKey = process.env.MCP_API_KEY;

  if (!apiKey) {
    console.error('Error: MCP_API_KEY environment variable is required');
    console.error('Generate a key from Settings > MCP in the GoodRev CRM UI');
    process.exit(1);
  }

  // Authenticate the API key
  const context = await authenticateApiKey(apiKey);
  if (!context) {
    console.error('Error: Invalid or expired MCP API key');
    process.exit(1);
  }

  console.error(`[GoodRev MCP] Authenticated as ${context.role} for project ${context.projectId}`);

  // Create and start the server
  const server = createMcpServer(() => context);
  const transport = new StdioServerTransport();

  await server.connect(transport);
  console.error('[GoodRev MCP] Server started on stdio transport');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
