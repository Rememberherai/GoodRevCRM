import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { registerOrganizationTools } from './tools/organizations';
import { registerPeopleTools } from './tools/people';
import { registerSearchTools } from './tools/search';
import { registerWorkflowTools } from './tools/workflows';
import { registerReportTools } from './tools/reports';
import { registerContractTools } from './tools/contracts';
import { registerProductTools } from './tools/products';
import { registerQuoteTools } from './tools/quotes';
import type { McpContext } from '@/types/mcp';

const SERVER_NAME = 'goodrev-crm';
const SERVER_VERSION = '1.0.0';

/**
 * Create a configured MCP server instance with all tools registered.
 * The getContext function is called per-tool-invocation to get the authenticated context.
 */
export function createMcpServer(getContext: () => McpContext): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  // Register all tool modules
  registerOrganizationTools(server, getContext);
  registerPeopleTools(server, getContext);
  registerSearchTools(server, getContext);
  registerWorkflowTools(server, getContext);
  registerReportTools(server, getContext);
  registerContractTools(server, getContext);
  registerProductTools(server, getContext);
  registerQuoteTools(server, getContext);

  // Register MCP resources
  registerResources(server, getContext);

  // Register MCP prompts
  registerPrompts(server);

  return server;
}

function registerResources(server: McpServer, getContext: () => McpContext) {
  server.resource(
    'pipeline-summary',
    'goodrev://pipeline/summary',
    { description: 'Pipeline stage breakdown with counts and values', mimeType: 'application/json' },
    async () => {
      const ctx = getContext();
      const { data } = await ctx.supabase
        .from('opportunities')
        .select('stage, amount')
        .eq('project_id', ctx.projectId)
        .is('deleted_at', null);

      const summary: Record<string, { count: number; total_amount: number }> = {};
      for (const opp of data ?? []) {
        const stage = opp.stage ?? 'unknown';
        if (!summary[stage]) summary[stage] = { count: 0, total_amount: 0 };
        summary[stage].count++;
        summary[stage].total_amount += opp.amount ?? 0;
      }

      return {
        contents: [{
          uri: 'goodrev://pipeline/summary',
          mimeType: 'application/json',
          text: JSON.stringify(summary),
        }],
      };
    }
  );

  server.resource(
    'my-open-tasks',
    'goodrev://tasks/my-open',
    { description: 'Current user\'s open tasks', mimeType: 'application/json' },
    async () => {
      const ctx = getContext();
      const { data } = await ctx.supabase
        .from('tasks')
        .select('id, title, priority, due_date, status')
        .eq('project_id', ctx.projectId)
        .eq('assigned_to', ctx.userId)
        .neq('status', 'completed')
        .order('due_date', { ascending: true })
        .limit(50);

      return {
        contents: [{
          uri: 'goodrev://tasks/my-open',
          mimeType: 'application/json',
          text: JSON.stringify(data ?? []),
        }],
      };
    }
  );
}

function registerPrompts(server: McpServer) {
  server.prompt(
    'qualify-lead',
    'Produce a qualification assessment for a person or organization based on CRM data',
    { entity_type: z.string().describe('organization or person'), entity_id: z.string().describe('The entity UUID') },
    async (params) => ({
      messages: [{
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: `You are a sales qualification expert. Using the GoodRev CRM MCP tools, look up the ${params.entity_type} with ID ${params.entity_id}. Then:\n\n1. Summarize key information about this lead\n2. Assess fit based on available data (industry, size, engagement)\n3. Check activity history and any existing opportunities\n4. Provide a BANT qualification (Budget, Authority, Need, Timeline)\n5. Recommend next steps\n\nUse the search and get tools to gather all relevant data before making your assessment.`,
        },
      }],
    })
  );

  server.prompt(
    'draft-outreach',
    'Draft a personalized outreach email for a contact',
    { person_id: z.string().describe('Person UUID to draft outreach for') },
    async (params) => ({
      messages: [{
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: `Using the GoodRev CRM MCP tools, look up person ${params.person_id} and their organization. Then draft a personalized cold outreach email that:\n\n1. References their role and company\n2. Connects to recent news about their organization (use news tools if available)\n3. Provides a clear, specific value proposition\n4. Includes a soft CTA\n5. Is concise (under 150 words)\n\nReturn the email with subject line and body.`,
        },
      }],
    })
  );

  server.prompt(
    'pipeline-review',
    'Analyze pipeline health and recommend actions',
    {},
    async () => ({
      messages: [{
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: `Using the GoodRev CRM MCP tools, perform a pipeline health review:\n\n1. Read the pipeline/summary resource for stage breakdown\n2. List opportunities to identify stale deals (no activity in 14+ days)\n3. Calculate conversion rates between stages\n4. Identify at-risk deals and opportunities that need attention\n5. Provide 3-5 specific, actionable recommendations\n\nPresent findings in a structured format with metrics and recommendations.`,
        },
      }],
    })
  );

  server.prompt(
    'meeting-prep',
    'Prepare a briefing document for an upcoming meeting',
    { organization_id: z.string().describe('Organization UUID to prepare for') },
    async (params) => ({
      messages: [{
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: `Using the GoodRev CRM MCP tools, prepare a meeting briefing for organization ${params.organization_id}:\n\n1. Get organization details and key contacts\n2. Review recent activity and communication history\n3. Check open opportunities and their stages\n4. Look for recent news about the organization\n5. Review any open tasks or pending items\n\nFormat as a concise briefing document with sections for: Company Overview, Key Contacts, Recent Activity, Open Opportunities, News & Context, and Talking Points.`,
        },
      }],
    })
  );
}
