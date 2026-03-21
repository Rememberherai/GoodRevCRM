import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { checkPermission } from '../auth';
import type { McpContext } from '@/types/mcp';

export function registerBugReportTools(server: McpServer, getContext: () => McpContext) {
  // bug_reports.list
  server.tool(
    'bug_reports.list',
    'List bug reports with optional status filtering and pagination (admin only)',
    {
      status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional().describe('Filter by status'),
      page: z.number().int().min(1).default(1).describe('Page number'),
      limit: z.number().int().min(1).max(100).default(50).describe('Items per page'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'admin');

      const { status, page, limit } = params;
      const offset = (page - 1) * limit;

      let query = ctx.supabase
        .from('bug_reports')
        .select('*, user:users!bug_reports_user_id_fkey(id, email, full_name)', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (status) query = query.eq('status', status);

      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;
      if (error) throw new Error(`Failed to list bug reports: ${error.message}`);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            bug_reports: data,
            pagination: { page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) },
          }),
        }],
      };
    }
  );

  // bug_reports.update_status
  server.tool(
    'bug_reports.update_status',
    'Update the status of a bug report (admin only)',
    {
      id: z.string().uuid().describe('Bug report ID'),
      status: z.enum(['open', 'in_progress', 'resolved', 'closed']).describe('New status'),
      resolution_notes: z.string().optional().describe('Notes about the resolution'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'admin');

      const { id, status, resolution_notes } = params;

      const update: Record<string, unknown> = { status };
      if (resolution_notes !== undefined) update.resolution_notes = resolution_notes;

      const { data, error } = await ctx.supabase
        .from('bug_reports')
        .update(update)
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(`Failed to update bug report: ${error.message}`);

      return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
    }
  );
}
