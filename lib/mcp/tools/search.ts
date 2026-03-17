import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { checkPermission } from '../auth';
import type { McpContext } from '@/types/mcp';

export function registerSearchTools(server: McpServer, getContext: () => McpContext) {
  // search.global
  server.tool(
    'search.global',
    'Search across all entity types (organizations, people, opportunities, RFPs, tasks) with a single query',
    {
      query: z.string().min(1).max(200).describe('Search query string'),
      entity_types: z
        .array(z.enum(['organizations', 'people', 'opportunities', 'rfps', 'tasks']))
        .optional()
        .describe('Limit search to specific entity types. Omit to search all.'),
      limit: z.number().int().min(1).max(20).default(10).describe('Results per entity type'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'viewer');

      const { query, entity_types, limit } = params;
      const sanitized = query.replace(/[%_\\]/g, '\\$&').replace(/"/g, '""');
      const types = entity_types ?? ['organizations', 'people', 'opportunities', 'rfps', 'tasks'];

      const results: Record<string, unknown[]> = {};

      const searches = types.map(async (type) => {
        switch (type) {
          case 'organizations': {
            const { data } = await ctx.supabase
              .from('organizations')
              .select('id, name, domain, industry')
              .eq('project_id', ctx.projectId)
              .is('deleted_at', null)
              .or(`name.ilike."%${sanitized}%",domain.ilike."%${sanitized}%",industry.ilike."%${sanitized}%"`)
              .limit(limit);
            results.organizations = data ?? [];
            break;
          }
          case 'people': {
            const { data } = await ctx.supabase
              .from('people')
              .select('id, first_name, last_name, email, job_title')
              .eq('project_id', ctx.projectId)
              .is('deleted_at', null)
              .or(`first_name.ilike."%${sanitized}%",last_name.ilike."%${sanitized}%",email.ilike."%${sanitized}%"`)
              .limit(limit);
            results.people = data ?? [];
            break;
          }
          case 'opportunities': {
            const { data } = await ctx.supabase
              .from('opportunities')
              .select('id, name, stage, value')
              .eq('project_id', ctx.projectId)
              .is('deleted_at', null)
              .ilike('name', `%${sanitized}%`)
              .limit(limit);
            results.opportunities = data ?? [];
            break;
          }
          case 'rfps': {
            const { data } = await ctx.supabase
              .from('rfps')
              .select('id, title, status')
              .eq('project_id', ctx.projectId)
              .is('deleted_at', null)
              .ilike('title', `%${sanitized}%`)
              .limit(limit);
            results.rfps = data ?? [];
            break;
          }
          case 'tasks': {
            const { data } = await ctx.supabase
              .from('tasks')
              .select('id, title, status, priority')
              .eq('project_id', ctx.projectId)
              .ilike('title', `%${sanitized}%`)
              .limit(limit);
            results.tasks = data ?? [];
            break;
          }
        }
      });

      await Promise.all(searches);

      const totalResults = Object.values(results).reduce((sum, arr) => sum + arr.length, 0);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ query, total_results: totalResults, results }),
        }],
      };
    }
  );
}
