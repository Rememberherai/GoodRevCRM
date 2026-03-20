import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { checkPermission } from '../auth';
import { emitAutomationEvent } from '@/lib/automations/engine';
import type { Json } from '@/types/database';
import type { McpContext } from '@/types/mcp';

export function registerPeopleTools(server: McpServer, getContext: () => McpContext) {
  // people.list
  server.tool(
    'people.list',
    'List and search people/contacts with pagination, sorting, and filtering',
    {
      page: z.number().int().min(1).default(1).describe('Page number'),
      limit: z.number().int().min(1).max(100).default(50).describe('Items per page'),
      search: z.string().optional().describe('Search by name, email, or job title'),
      organizationId: z.string().uuid().optional().describe('Filter by organization ID'),
      sortBy: z.enum(['first_name', 'last_name', 'email', 'created_at', 'updated_at', 'job_title']).default('created_at'),
      sortOrder: z.enum(['asc', 'desc']).default('desc'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'viewer');

      const { page, limit, search, organizationId, sortBy, sortOrder } = params;
      const offset = (page - 1) * limit;

      let query = ctx.supabase
        .from('people')
        .select('*', { count: 'exact' })
        .eq('project_id', ctx.projectId)
        .is('deleted_at', null);

      if (search) {
        const sanitized = search.replace(/[%_\\]/g, '\\$&').replace(/"/g, '""');
        query = query.or(
          `first_name.ilike."%${sanitized}%",last_name.ilike."%${sanitized}%",email.ilike."%${sanitized}%",job_title.ilike."%${sanitized}%"`
        );
      }

      if (organizationId) {
        const { data: personIds } = await ctx.supabase
          .from('person_organizations')
          .select('person_id')
          .eq('organization_id', organizationId)
          .eq('project_id', ctx.projectId);

        if (personIds && personIds.length > 0) {
          query = query.in('id', personIds.map((p) => p.person_id));
        } else {
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ people: [], pagination: { page, limit, total: 0, totalPages: 0 } }) }],
          };
        }
      }

      query = query.order(sortBy, { ascending: sortOrder === 'asc' });
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;
      if (error) throw new Error(`Failed to list people: ${error.message}`);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            people: data,
            pagination: { page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) },
          }),
        }],
      };
    }
  );

  // people.get
  server.tool(
    'people.get',
    'Get a single person/contact by ID with full details',
    {
      id: z.string().uuid().describe('Person ID'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'viewer');

      const { data, error } = await ctx.supabase
        .from('people')
        .select('*')
        .eq('id', params.id)
        .eq('project_id', ctx.projectId)
        .is('deleted_at', null)
        .single();

      if (error) throw new Error(`Person not found: ${error.message}`);

      return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
    }
  );

  // people.create
  server.tool(
    'people.create',
    'Create a new person/contact in the CRM',
    {
      first_name: z.string().min(1).max(100).describe('First name'),
      last_name: z.string().min(1).max(100).describe('Last name'),
      email: z.string().email().max(255).nullable().optional().describe('Email address'),
      phone: z.string().max(50).nullable().optional().describe('Phone number'),
      mobile_phone: z.string().max(50).nullable().optional().describe('Mobile phone'),
      linkedin_url: z.string().url().max(500).nullable().optional().describe('LinkedIn profile URL'),
      job_title: z.string().max(200).nullable().optional().describe('Job title'),
      department: z.string().max(100).nullable().optional().describe('Department'),
      notes: z.string().max(2000).nullable().optional().describe('Notes'),
      organization_id: z.string().uuid().optional().describe('Link to organization'),
      disposition_id: z.string().uuid().nullable().optional().describe('Disposition (status) ID'),
      custom_fields: z.record(z.string(), z.unknown()).optional().describe('Custom field values'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'member');

      const { organization_id, custom_fields, ...personFields } = params;

      const { data, error } = await ctx.supabase
        .from('people')
        .insert({
          ...personFields,
          custom_fields: custom_fields as unknown as Json,
          project_id: ctx.projectId,
          created_by: ctx.userId,
        })
        .select()
        .single();

      if (error) throw new Error(`Failed to create person: ${error.message}`);

      // Link to organization if provided
      if (organization_id) {
        await ctx.supabase
          .from('person_organizations')
          .insert({
            person_id: data.id,
            organization_id,
            project_id: ctx.projectId,
            is_primary: true,
          });
      }

      emitAutomationEvent({
        projectId: ctx.projectId,
        triggerType: 'entity.created',
        entityType: 'person',
        entityId: data.id,
        data: data as Record<string, unknown>,
      });

      return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
    }
  );

  // people.update
  server.tool(
    'people.update',
    'Update an existing person/contact',
    {
      id: z.string().uuid().describe('Person ID'),
      first_name: z.string().min(1).max(100).optional(),
      last_name: z.string().min(1).max(100).optional(),
      email: z.string().email().max(255).nullable().optional(),
      phone: z.string().max(50).nullable().optional(),
      mobile_phone: z.string().max(50).nullable().optional(),
      linkedin_url: z.string().url().max(500).nullable().optional(),
      job_title: z.string().max(200).nullable().optional(),
      department: z.string().max(100).nullable().optional(),
      notes: z.string().max(2000).nullable().optional(),
      disposition_id: z.string().uuid().nullable().optional().describe('Disposition (status) ID'),
      custom_fields: z.record(z.string(), z.unknown()).optional(),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'member');

      const { id, custom_fields: cf, ...updates } = params;
      const updateData = cf !== undefined ? { ...updates, custom_fields: cf as unknown as Json } : updates;

      const { data, error } = await ctx.supabase
        .from('people')
        .update(updateData)
        .eq('id', id)
        .eq('project_id', ctx.projectId)
        .is('deleted_at', null)
        .select()
        .single();

      if (error) throw new Error(`Failed to update person: ${error.message}`);

      emitAutomationEvent({
        projectId: ctx.projectId,
        triggerType: 'entity.updated',
        entityType: 'person',
        entityId: data.id,
        data: data as Record<string, unknown>,
      });

      return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
    }
  );

  // people.delete
  server.tool(
    'people.delete',
    'Soft-delete a person/contact',
    {
      id: z.string().uuid().describe('Person ID'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'member');

      const { data, error } = await ctx.supabase
        .from('people')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', params.id)
        .eq('project_id', ctx.projectId)
        .is('deleted_at', null)
        .select()
        .single();

      if (error) throw new Error(`Failed to delete person: ${error.message}`);

      emitAutomationEvent({
        projectId: ctx.projectId,
        triggerType: 'entity.deleted',
        entityType: 'person',
        entityId: data.id,
        data: data as Record<string, unknown>,
      });

      return { content: [{ type: 'text' as const, text: JSON.stringify({ deleted: true, id: data.id }) }] };
    }
  );

  // people.link_organization
  server.tool(
    'people.link_organization',
    'Link a person to an organization with optional title and department',
    {
      person_id: z.string().uuid().describe('Person ID'),
      organization_id: z.string().uuid().describe('Organization ID'),
      job_title: z.string().max(200).nullable().optional().describe('Role/title at org'),
      department: z.string().max(100).nullable().optional().describe('Department'),
      is_primary: z.boolean().default(false).describe('Set as primary organization'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'member');

      const { data, error } = await ctx.supabase
        .from('person_organizations')
        .upsert({
          person_id: params.person_id,
          organization_id: params.organization_id,
          project_id: ctx.projectId,
          job_title: params.job_title,
          department: params.department,
          is_primary: params.is_primary,
        }, { onConflict: 'person_id,organization_id' })
        .select()
        .single();

      if (error) throw new Error(`Failed to link person to organization: ${error.message}`);

      return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
    }
  );
}
