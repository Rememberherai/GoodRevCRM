import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { checkPermission } from '../auth';
import { emitAutomationEvent } from '@/lib/automations/engine';
import type { McpContext } from '@/types/mcp';

export function registerDispositionTools(server: McpServer, getContext: () => McpContext) {
  // dispositions.list
  server.tool(
    'dispositions.list',
    'List dispositions (status categories) for organizations or people',
    {
      entity_type: z.enum(['organization', 'person']).describe('Entity type to list dispositions for'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'viewer');

      const { data, error } = await ctx.supabase
        .from('dispositions')
        .select('*')
        .eq('project_id', ctx.projectId)
        .eq('entity_type', params.entity_type)
        .is('deleted_at', null)
        .order('sort_order', { ascending: true });

      if (error) throw new Error(`Failed to list dispositions: ${error.message}`);

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ dispositions: data }) }],
      };
    }
  );

  // dispositions.create
  server.tool(
    'dispositions.create',
    'Create a new disposition (status category) for organizations or people',
    {
      name: z.string().min(1).max(50).describe('Disposition name, e.g. "Customer", "Prospect"'),
      entity_type: z.enum(['organization', 'person']).describe('Entity type this disposition applies to'),
      color: z.enum(['gray', 'blue', 'green', 'red', 'yellow', 'purple', 'orange', 'pink']).default('gray').describe('Badge color'),
      is_default: z.boolean().default(false).describe('Auto-assign to new records'),
      sort_order: z.number().int().min(0).default(0).describe('Display order'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'member');

      // Clear other defaults if setting this as default
      if (params.is_default) {
        await ctx.supabase
          .from('dispositions')
          .update({ is_default: false })
          .eq('project_id', ctx.projectId)
          .eq('entity_type', params.entity_type)
          .eq('is_default', true)
          .is('deleted_at', null);
      }

      const { data, error } = await ctx.supabase
        .from('dispositions')
        .insert({
          ...params,
          project_id: ctx.projectId,
          created_by: ctx.userId,
        })
        .select()
        .single();

      if (error) throw new Error(`Failed to create disposition: ${error.message}`);

      emitAutomationEvent({
        projectId: ctx.projectId,
        triggerType: 'entity.created',
        entityType: 'disposition',
        entityId: data.id,
        data: data as Record<string, unknown>,
      }).catch((e) => console.error('Automation event error:', e));

      return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
    }
  );

  // dispositions.update
  server.tool(
    'dispositions.update',
    'Update an existing disposition',
    {
      id: z.string().uuid().describe('Disposition ID'),
      name: z.string().min(1).max(50).optional(),
      color: z.enum(['gray', 'blue', 'green', 'red', 'yellow', 'purple', 'orange', 'pink']).optional(),
      is_default: z.boolean().optional(),
      sort_order: z.number().int().min(0).optional(),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'member');

      const { id, ...updates } = params;

      // If setting as default, clear others
      if (updates.is_default) {
        const { data: existing } = await ctx.supabase
          .from('dispositions')
          .select('entity_type')
          .eq('id', id)
          .eq('project_id', ctx.projectId)
          .single();

        if (existing) {
          await ctx.supabase
            .from('dispositions')
            .update({ is_default: false })
            .eq('project_id', ctx.projectId)
            .eq('entity_type', existing.entity_type)
            .eq('is_default', true)
            .is('deleted_at', null);
        }
      }

      const { data, error } = await ctx.supabase
        .from('dispositions')
        .update(updates)
        .eq('id', id)
        .eq('project_id', ctx.projectId)
        .is('deleted_at', null)
        .select()
        .single();

      if (error) throw new Error(`Failed to update disposition: ${error.message}`);

      emitAutomationEvent({
        projectId: ctx.projectId,
        triggerType: 'entity.updated',
        entityType: 'disposition',
        entityId: data.id,
        data: data as Record<string, unknown>,
      }).catch((e) => console.error('Automation event error:', e));

      return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
    }
  );

  // dispositions.delete
  server.tool(
    'dispositions.delete',
    'Delete a disposition (soft delete). Records using it will have their disposition cleared.',
    {
      id: z.string().uuid().describe('Disposition ID'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'member');

      // Get entity_type before deletion
      const { data: existing, error: fetchError } = await ctx.supabase
        .from('dispositions')
        .select('entity_type')
        .eq('id', params.id)
        .eq('project_id', ctx.projectId)
        .is('deleted_at', null)
        .single();

      if (fetchError) throw new Error(`Disposition not found: ${fetchError.message}`);

      // Soft delete
      const { data, error } = await ctx.supabase
        .from('dispositions')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', params.id)
        .eq('project_id', ctx.projectId)
        .is('deleted_at', null)
        .select()
        .single();

      if (error) throw new Error(`Failed to delete disposition: ${error.message}`);

      // Null out references
      const table = existing.entity_type === 'organization' ? 'organizations' : 'people';
      await ctx.supabase
        .from(table)
        .update({ disposition_id: null })
        .eq('disposition_id', params.id)
        .eq('project_id', ctx.projectId);

      emitAutomationEvent({
        projectId: ctx.projectId,
        triggerType: 'entity.deleted',
        entityType: 'disposition',
        entityId: data.id,
        data: data as Record<string, unknown>,
      }).catch((e) => console.error('Automation event error:', e));

      return { content: [{ type: 'text' as const, text: JSON.stringify({ success: true }) }] };
    }
  );
}
