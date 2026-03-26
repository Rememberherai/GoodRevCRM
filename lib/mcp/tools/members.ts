import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { checkPermission } from '../auth';
import type { McpContext } from '@/types/mcp';

export function registerMemberTools(server: McpServer, getContext: () => McpContext) {
  // members.listOverrides
  server.tool(
    'members.listOverrides',
    'List all permission overrides for a specific project member',
    {
      user_id: z.string().uuid().describe('The user ID of the project member'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'admin');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabaseAny = ctx.supabase as any;

      const { data, error } = await supabaseAny
        .from('project_membership_overrides')
        .select('id, resource, granted, created_at, updated_at')
        .eq('project_id', ctx.projectId)
        .eq('user_id', params.user_id)
        .order('resource');

      if (error) throw new Error(`Failed to list overrides: ${error.message}`);

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ overrides: data ?? [] }) }],
      };
    }
  );

  // members.setOverride
  server.tool(
    'members.setOverride',
    'Set or remove a permission override for a project member. Pass granted=null to remove the override and restore default role-based behavior.',
    {
      user_id: z.string().uuid().describe('The user ID of the project member'),
      resource: z.string().min(1).max(64).describe('Resource name, e.g. "grants", "reports", "households"'),
      granted: z.boolean().nullable().describe('true = grant access, false = deny access, null = remove override'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'admin');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabaseAny = ctx.supabase as any;

      // Get target member's role — enforce owner/admin guards
      const { data: targetMembership } = await supabaseAny
        .from('project_memberships')
        .select('role')
        .eq('project_id', ctx.projectId)
        .eq('user_id', params.user_id)
        .maybeSingle();

      if (!targetMembership) {
        throw new Error('Member not found in this project');
      }

      if (targetMembership.role === 'owner') {
        throw new Error('Cannot set overrides on the project owner');
      }

      // Admins cannot set overrides on other admins — only owners can
      if (ctx.role === 'admin' && targetMembership.role === 'admin') {
        throw new Error('Admins cannot set overrides on other admins');
      }

      if (params.granted === null) {
        // Remove override
        const { error } = await supabaseAny
          .from('project_membership_overrides')
          .delete()
          .eq('project_id', ctx.projectId)
          .eq('user_id', params.user_id)
          .eq('resource', params.resource);

        if (error) throw new Error(`Failed to remove override: ${error.message}`);

        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: true, action: 'removed' }) }],
        };
      }

      // Upsert override
      const { data, error } = await supabaseAny
        .from('project_membership_overrides')
        .upsert(
          {
            project_id: ctx.projectId,
            user_id: params.user_id,
            resource: params.resource,
            granted: params.granted,
          },
          { onConflict: 'project_id,user_id,resource' }
        )
        .select('id, resource, granted')
        .maybeSingle();

      if (error) throw new Error(`Failed to set override: ${error.message}`);

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ success: true, override: data }) }],
      };
    }
  );
}
