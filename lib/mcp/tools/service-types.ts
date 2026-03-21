import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { checkPermission } from '../auth';
import { emitAutomationEvent } from '@/lib/automations/engine';
import type { McpContext } from '@/types/mcp';

export function registerServiceTypeTools(server: McpServer, getContext: () => McpContext) {
  // service_types.list
  server.tool(
    'service_types.list',
    'List service types configured for the project (used across jobs, contractors, and referrals)',
    {},
    async () => {
      const ctx = getContext();
      checkPermission(ctx.role, 'viewer');

      const { data, error } = await ctx.supabase
        .from('service_types')
        .select('*')
        .eq('project_id', ctx.projectId)
        .is('deleted_at', null)
        .order('sort_order', { ascending: true });

      if (error) throw new Error(`Failed to list service types: ${error.message}`);

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ serviceTypes: data }) }],
      };
    }
  );

  // service_types.create
  server.tool(
    'service_types.create',
    'Create a new service type for categorizing jobs, contractors, and referrals',
    {
      name: z.string().min(1).max(50).describe('Service type name, e.g. "Plumbing", "Electrical"'),
      color: z.enum(['gray', 'blue', 'green', 'red', 'yellow', 'purple', 'orange', 'pink']).default('gray').describe('Badge color'),
      is_active: z.boolean().default(true).describe('Whether this type is available for selection'),
      sort_order: z.number().int().min(0).default(0).describe('Display order'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'member');

      const { data, error } = await ctx.supabase
        .from('service_types')
        .insert({
          ...params,
          project_id: ctx.projectId,
          created_by: ctx.userId,
        })
        .select()
        .single();

      if (error) throw new Error(`Failed to create service type: ${error.message}`);

      emitAutomationEvent({
        projectId: ctx.projectId,
        triggerType: 'entity.created',
        entityType: 'service_type',
        entityId: data.id,
        data: data as Record<string, unknown>,
      }).catch((e) => console.error('Automation event error:', e));

      return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
    }
  );

  // service_types.update
  server.tool(
    'service_types.update',
    'Update an existing service type',
    {
      id: z.string().uuid().describe('Service type ID'),
      name: z.string().min(1).max(50).optional(),
      color: z.enum(['gray', 'blue', 'green', 'red', 'yellow', 'purple', 'orange', 'pink']).optional(),
      is_active: z.boolean().optional(),
      sort_order: z.number().int().min(0).optional(),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'member');

      const { id, ...updates } = params;

      const { data, error } = await ctx.supabase
        .from('service_types')
        .update(updates)
        .eq('id', id)
        .eq('project_id', ctx.projectId)
        .is('deleted_at', null)
        .select()
        .single();

      if (error) throw new Error(`Failed to update service type: ${error.message}`);

      emitAutomationEvent({
        projectId: ctx.projectId,
        triggerType: 'entity.updated',
        entityType: 'service_type',
        entityId: data.id,
        data: data as Record<string, unknown>,
      }).catch((e) => console.error('Automation event error:', e));

      return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
    }
  );

  // service_types.delete
  server.tool(
    'service_types.delete',
    'Delete a service type (soft delete). Records using it will have their service type cleared.',
    {
      id: z.string().uuid().describe('Service type ID'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'member');

      // Soft delete
      const { data, error } = await ctx.supabase
        .from('service_types')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', params.id)
        .eq('project_id', ctx.projectId)
        .is('deleted_at', null)
        .select()
        .single();

      if (error) throw new Error(`Failed to delete service type: ${error.message}`);

      // Null out references on jobs and referrals
      await ctx.supabase
        .from('jobs')
        .update({ service_type_id: null })
        .eq('service_type_id', params.id);

      await ctx.supabase
        .from('referrals')
        .update({ service_type_id: null })
        .eq('service_type_id', params.id);

      // Remove from contractor_scopes service_type_ids arrays
      const { data: scopes } = await ctx.supabase
        .from('contractor_scopes')
        .select('id, service_type_ids')
        .contains('service_type_ids', [params.id]);

      if (scopes && scopes.length > 0) {
        await Promise.all(
          scopes.map((scope) =>
            ctx.supabase
              .from('contractor_scopes')
              .update({
                service_type_ids: (scope.service_type_ids as string[]).filter(
                  (id) => id !== params.id
                ),
              })
              .eq('id', scope.id)
          )
        );
      }

      emitAutomationEvent({
        projectId: ctx.projectId,
        triggerType: 'entity.deleted',
        entityType: 'service_type',
        entityId: data.id,
        data: data as Record<string, unknown>,
      }).catch((e) => console.error('Automation event error:', e));

      return { content: [{ type: 'text' as const, text: JSON.stringify({ success: true }) }] };
    }
  );
}
