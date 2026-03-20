import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { checkPermission } from '../auth';
import { emitAutomationEvent } from '@/lib/automations/engine';
import type { Json } from '@/types/database';
import type { McpContext } from '@/types/mcp';

export function registerOrganizationTools(server: McpServer, getContext: () => McpContext) {
  // organizations.list
  server.tool(
    'organizations.list',
    'List and search organizations with pagination, sorting, and filtering',
    {
      page: z.number().int().min(1).default(1).describe('Page number'),
      limit: z.number().int().min(1).max(100).default(50).describe('Items per page'),
      search: z.string().optional().describe('Search by name, domain, or industry'),
      sortBy: z.enum(['name', 'domain', 'industry', 'created_at', 'updated_at']).default('created_at').describe('Sort column'),
      sortOrder: z.enum(['asc', 'desc']).default('desc').describe('Sort direction'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'viewer');

      const { page, limit, search, sortBy, sortOrder } = params;
      const offset = (page - 1) * limit;

      let query = ctx.supabase
        .from('organizations')
        .select('*', { count: 'exact' })
        .eq('project_id', ctx.projectId)
        .is('deleted_at', null);

      if (search) {
        const sanitized = search.replace(/[%_\\]/g, '\\$&').replace(/"/g, '""');
        query = query.or(`name.ilike."%${sanitized}%",domain.ilike."%${sanitized}%",industry.ilike."%${sanitized}%"`);
      }

      query = query.order(sortBy, { ascending: sortOrder === 'asc' });
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;
      if (error) throw new Error(`Failed to list organizations: ${error.message}`);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            organizations: data,
            pagination: { page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) },
          }),
        }],
      };
    }
  );

  // organizations.get
  server.tool(
    'organizations.get',
    'Get a single organization by ID with full details',
    {
      id: z.string().uuid().describe('Organization ID'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'viewer');

      const { data, error } = await ctx.supabase
        .from('organizations')
        .select('*')
        .eq('id', params.id)
        .eq('project_id', ctx.projectId)
        .is('deleted_at', null)
        .single();

      if (error) throw new Error(`Organization not found: ${error.message}`);

      return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
    }
  );

  // organizations.create
  server.tool(
    'organizations.create',
    'Create a new organization in the CRM',
    {
      name: z.string().min(1).max(200).describe('Organization name'),
      domain: z.string().max(100).nullable().optional().describe('Primary domain'),
      website: z.string().url().max(500).nullable().optional().describe('Website URL'),
      industry: z.string().max(100).nullable().optional().describe('Industry'),
      employee_count: z.number().int().min(0).nullable().optional().describe('Number of employees'),
      annual_revenue: z.number().min(0).nullable().optional().describe('Annual revenue'),
      description: z.string().max(2000).nullable().optional().describe('Description'),
      phone: z.string().max(50).nullable().optional().describe('Phone number'),
      address_street: z.string().max(200).nullable().optional(),
      address_city: z.string().max(100).nullable().optional(),
      address_state: z.string().max(100).nullable().optional(),
      address_postal_code: z.string().max(20).nullable().optional(),
      address_country: z.string().max(100).nullable().optional(),
      disposition_id: z.string().uuid().nullable().optional().describe('Disposition (status) ID'),
      custom_fields: z.record(z.string(), z.unknown()).optional().describe('Custom field values'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'member');

      const { custom_fields, ...rest } = params;
      const { data, error } = await ctx.supabase
        .from('organizations')
        .insert({
          ...rest,
          custom_fields: custom_fields as unknown as Json,
          project_id: ctx.projectId,
          created_by: ctx.userId,
        })
        .select()
        .single();

      if (error) throw new Error(`Failed to create organization: ${error.message}`);

      emitAutomationEvent({
        projectId: ctx.projectId,
        triggerType: 'entity.created',
        entityType: 'organization',
        entityId: data.id,
        data: data as Record<string, unknown>,
      });

      return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
    }
  );

  // organizations.update
  server.tool(
    'organizations.update',
    'Update an existing organization',
    {
      id: z.string().uuid().describe('Organization ID'),
      name: z.string().min(1).max(200).optional(),
      domain: z.string().max(100).nullable().optional(),
      website: z.string().url().max(500).nullable().optional(),
      industry: z.string().max(100).nullable().optional(),
      employee_count: z.number().int().min(0).nullable().optional(),
      annual_revenue: z.number().min(0).nullable().optional(),
      description: z.string().max(2000).nullable().optional(),
      phone: z.string().max(50).nullable().optional(),
      address_street: z.string().max(200).nullable().optional(),
      address_city: z.string().max(100).nullable().optional(),
      address_state: z.string().max(100).nullable().optional(),
      address_postal_code: z.string().max(20).nullable().optional(),
      address_country: z.string().max(100).nullable().optional(),
      disposition_id: z.string().uuid().nullable().optional().describe('Disposition (status) ID'),
      custom_fields: z.record(z.string(), z.unknown()).optional(),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'member');

      const { id, custom_fields: cf, ...updates } = params;
      const updateData = cf !== undefined ? { ...updates, custom_fields: cf as unknown as Json } : updates;

      const { data, error } = await ctx.supabase
        .from('organizations')
        .update(updateData)
        .eq('id', id)
        .eq('project_id', ctx.projectId)
        .is('deleted_at', null)
        .select()
        .single();

      if (error) throw new Error(`Failed to update organization: ${error.message}`);

      emitAutomationEvent({
        projectId: ctx.projectId,
        triggerType: 'entity.updated',
        entityType: 'organization',
        entityId: data.id,
        data: data as Record<string, unknown>,
      });

      return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
    }
  );

  // organizations.delete
  server.tool(
    'organizations.delete',
    'Soft-delete an organization',
    {
      id: z.string().uuid().describe('Organization ID'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'member');

      const { data, error } = await ctx.supabase
        .from('organizations')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', params.id)
        .eq('project_id', ctx.projectId)
        .is('deleted_at', null)
        .select()
        .single();

      if (error) throw new Error(`Failed to delete organization: ${error.message}`);

      emitAutomationEvent({
        projectId: ctx.projectId,
        triggerType: 'entity.deleted',
        entityType: 'organization',
        entityId: data.id,
        data: data as Record<string, unknown>,
      });

      return { content: [{ type: 'text' as const, text: JSON.stringify({ deleted: true, id: data.id }) }] };
    }
  );

  // organizations.get_people
  server.tool(
    'organizations.get_people',
    'Get all people linked to an organization',
    {
      id: z.string().uuid().describe('Organization ID'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'viewer');

      const { data: links, error: linkError } = await ctx.supabase
        .from('person_organizations')
        .select('person_id, job_title, department, is_primary')
        .eq('organization_id', params.id)
        .eq('project_id', ctx.projectId);

      if (linkError) throw new Error(`Failed to get linked people: ${linkError.message}`);
      if (!links || links.length === 0) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ people: [] }) }] };
      }

      const personIds = links.map((l) => l.person_id);
      const { data: people, error } = await ctx.supabase
        .from('people')
        .select('*')
        .in('id', personIds)
        .is('deleted_at', null);

      if (error) throw new Error(`Failed to fetch people: ${error.message}`);

      return { content: [{ type: 'text' as const, text: JSON.stringify({ people, links }) }] };
    }
  );
}
