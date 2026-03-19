import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { checkPermission } from '@/lib/mcp/auth';
import { emitAutomationEvent } from '@/lib/automations/engine';
import { sendBookingCancellation } from '@/lib/calendar/notifications';
import type { Json } from '@/types/database';
import type { McpContext } from '@/types/mcp';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ChatTool {
  name: string;
  description: string;
  parameters: z.ZodObject<z.ZodRawShape>;
  minRole: 'viewer' | 'member' | 'admin' | 'owner';
  handler: (params: Record<string, unknown>, ctx: McpContext) => Promise<string>;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

// ── Tool Registry ────────────────────────────────────────────────────────────

const tools: ChatTool[] = [];

function defineTool(tool: ChatTool) {
  tools.push(tool);
}

// ── Organization Tools ───────────────────────────────────────────────────────

defineTool({
  name: 'organizations.list',
  description: 'List and search organizations with pagination, sorting, and filtering',
  minRole: 'viewer',
  parameters: z.object({
    page: z.number().int().min(1).default(1).describe('Page number'),
    limit: z.number().int().min(1).max(100).default(50).describe('Items per page'),
    search: z.string().optional().describe('Search by name, domain, or industry'),
    sortBy: z.enum(['name', 'domain', 'industry', 'created_at', 'updated_at']).default('created_at').describe('Sort column'),
    sortOrder: z.enum(['asc', 'desc']).default('desc').describe('Sort direction'),
  }),
  handler: async (params, ctx) => {
    const { page = 1, limit = 50, search, sortBy = 'created_at', sortOrder = 'desc' } = params as {
      page?: number; limit?: number; search?: string; sortBy?: string; sortOrder?: string;
    };
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

    query = query.order(sortBy as 'name', { ascending: sortOrder === 'asc' });
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw new Error(`Failed to list organizations: ${error.message}`);

    return JSON.stringify({
      organizations: data,
      pagination: { page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) },
    });
  },
});

defineTool({
  name: 'organizations.get',
  description: 'Get a single organization by ID with full details',
  minRole: 'viewer',
  parameters: z.object({
    organization_id: z.string().uuid().describe('Organization ID'),
  }),
  handler: async (params, ctx) => {
    const { data, error } = await ctx.supabase
      .from('organizations')
      .select('*')
      .eq('id', params.organization_id as string)
      .eq('project_id', ctx.projectId)
      .is('deleted_at', null)
      .single();

    if (error) throw new Error(`Organization not found: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'organizations.create',
  description: 'Create a new organization in the CRM',
  minRole: 'member',
  parameters: z.object({
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
    custom_fields: z.record(z.string(), z.unknown()).optional().describe('Custom field values'),
  }),
  handler: async (params, ctx) => {
    const { custom_fields, ...rest } = params as Record<string, unknown>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic tool params
    const { data, error } = await ctx.supabase
      .from('organizations')
      .insert({
        ...(rest as Record<string, unknown>),
        custom_fields: custom_fields as unknown as Json,
        project_id: ctx.projectId,
        created_by: ctx.userId,
      } as any)
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

    return JSON.stringify(data);
  },
});

defineTool({
  name: 'organizations.update',
  description: 'Update an existing organization',
  minRole: 'member',
  parameters: z.object({
    organization_id: z.string().uuid().describe('Organization ID'),
    name: z.string().min(1).max(200).optional(),
    domain: z.string().max(100).nullable().optional(),
    website: z.string().url().max(500).nullable().optional(),
    industry: z.string().max(100).nullable().optional(),
    employee_count: z.number().int().min(0).nullable().optional(),
    annual_revenue: z.number().min(0).nullable().optional(),
    description: z.string().max(2000).nullable().optional(),
    phone: z.string().max(50).nullable().optional(),
    custom_fields: z.record(z.string(), z.unknown()).optional(),
  }),
  handler: async (params, ctx) => {
    const { organization_id: id, custom_fields: cf, ...updates } = params as Record<string, unknown>;
    const updateData = cf !== undefined ? { ...updates, custom_fields: cf as unknown as Json } : updates;

    const { data, error } = await ctx.supabase
      .from('organizations')
      .update(updateData as Record<string, unknown>)
      .eq('id', id as string)
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

    return JSON.stringify(data);
  },
});

defineTool({
  name: 'organizations.delete',
  description: 'Soft-delete an organization',
  minRole: 'member',
  parameters: z.object({
    organization_id: z.string().uuid().describe('Organization ID'),
  }),
  handler: async (params, ctx) => {
    const { data, error } = await ctx.supabase
      .from('organizations')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', params.organization_id as string)
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

    return JSON.stringify({ deleted: true, id: data.id });
  },
});

defineTool({
  name: 'organizations.get_people',
  description: 'Get all people linked to an organization',
  minRole: 'viewer',
  parameters: z.object({
    organization_id: z.string().uuid().describe('Organization ID'),
  }),
  handler: async (params, ctx) => {
    const { data: links, error: linkError } = await ctx.supabase
      .from('person_organizations')
      .select('person_id, job_title, department, is_primary')
      .eq('organization_id', params.organization_id as string)
      .eq('project_id', ctx.projectId);

    if (linkError) throw new Error(`Failed to get linked people: ${linkError.message}`);
    if (!links || links.length === 0) return JSON.stringify({ people: [] });

    const personIds = links.map((l) => l.person_id);
    const { data: people, error } = await ctx.supabase
      .from('people')
      .select('*')
      .in('id', personIds)
      .is('deleted_at', null);

    if (error) throw new Error(`Failed to fetch people: ${error.message}`);
    return JSON.stringify({ people, links });
  },
});

// ── People Tools ─────────────────────────────────────────────────────────────

defineTool({
  name: 'people.list',
  description: 'List and search people/contacts with pagination, sorting, and filtering',
  minRole: 'viewer',
  parameters: z.object({
    page: z.number().int().min(1).default(1).describe('Page number'),
    limit: z.number().int().min(1).max(100).default(50).describe('Items per page'),
    search: z.string().optional().describe('Search by name, email, or job title'),
    organizationId: z.string().uuid().optional().describe('Filter by organization ID'),
    sortBy: z.enum(['first_name', 'last_name', 'email', 'created_at', 'updated_at', 'job_title']).default('created_at'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
  handler: async (params, ctx) => {
    const { page = 1, limit = 50, search, organizationId, sortBy = 'created_at', sortOrder = 'desc' } = params as {
      page?: number; limit?: number; search?: string; organizationId?: string; sortBy?: string; sortOrder?: string;
    };
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
        return JSON.stringify({ people: [], pagination: { page, limit, total: 0, totalPages: 0 } });
      }
    }

    query = query.order(sortBy as 'first_name', { ascending: sortOrder === 'asc' });
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw new Error(`Failed to list people: ${error.message}`);

    return JSON.stringify({
      people: data,
      pagination: { page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) },
    });
  },
});

defineTool({
  name: 'people.get',
  description: 'Get a single person/contact by ID with full details',
  minRole: 'viewer',
  parameters: z.object({
    person_id: z.string().uuid().describe('Person ID'),
  }),
  handler: async (params, ctx) => {
    const { data, error } = await ctx.supabase
      .from('people')
      .select('*')
      .eq('id', params.person_id as string)
      .eq('project_id', ctx.projectId)
      .is('deleted_at', null)
      .single();

    if (error) throw new Error(`Person not found: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'people.create',
  description: 'Create a new person/contact in the CRM',
  minRole: 'member',
  parameters: z.object({
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
    custom_fields: z.record(z.string(), z.unknown()).optional().describe('Custom field values'),
  }),
  handler: async (params, ctx) => {
    const { organization_id, custom_fields, ...personFields } = params as Record<string, unknown>;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic tool params
    const { data, error } = await ctx.supabase
      .from('people')
      .insert({
        ...(personFields as Record<string, unknown>),
        custom_fields: custom_fields as unknown as Json,
        project_id: ctx.projectId,
        created_by: ctx.userId,
      } as any)
      .select()
      .single();

    if (error) throw new Error(`Failed to create person: ${error.message}`);

    if (organization_id) {
      await ctx.supabase
        .from('person_organizations')
        .insert({
          person_id: data.id,
          organization_id: organization_id as string,
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

    return JSON.stringify(data);
  },
});

defineTool({
  name: 'people.update',
  description: 'Update an existing person/contact',
  minRole: 'member',
  parameters: z.object({
    person_id: z.string().uuid().describe('Person ID'),
    first_name: z.string().min(1).max(100).optional(),
    last_name: z.string().min(1).max(100).optional(),
    email: z.string().email().max(255).nullable().optional(),
    phone: z.string().max(50).nullable().optional(),
    mobile_phone: z.string().max(50).nullable().optional(),
    linkedin_url: z.string().url().max(500).nullable().optional(),
    job_title: z.string().max(200).nullable().optional(),
    department: z.string().max(100).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
    custom_fields: z.record(z.string(), z.unknown()).optional(),
  }),
  handler: async (params, ctx) => {
    const { person_id: id, custom_fields: cf, ...updates } = params as Record<string, unknown>;
    const updateData = cf !== undefined ? { ...updates, custom_fields: cf as unknown as Json } : updates;

    const { data, error } = await ctx.supabase
      .from('people')
      .update(updateData as Record<string, unknown>)
      .eq('id', id as string)
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

    return JSON.stringify(data);
  },
});

defineTool({
  name: 'people.delete',
  description: 'Soft-delete a person/contact',
  minRole: 'member',
  parameters: z.object({
    person_id: z.string().uuid().describe('Person ID'),
  }),
  handler: async (params, ctx) => {
    const { data, error } = await ctx.supabase
      .from('people')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', params.person_id as string)
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

    return JSON.stringify({ deleted: true, id: data.id });
  },
});

defineTool({
  name: 'people.link_organization',
  description: 'Link a person to an organization with optional title and department',
  minRole: 'member',
  parameters: z.object({
    person_id: z.string().uuid().describe('Person ID'),
    organization_id: z.string().uuid().describe('Organization ID'),
    job_title: z.string().max(200).nullable().optional().describe('Role/title at org'),
    department: z.string().max(100).nullable().optional().describe('Department'),
    is_primary: z.boolean().default(false).describe('Set as primary organization'),
  }),
  handler: async (params, ctx) => {
    const { data, error } = await ctx.supabase
      .from('person_organizations')
      .upsert({
        person_id: params.person_id as string,
        organization_id: params.organization_id as string,
        project_id: ctx.projectId,
        job_title: params.job_title as string | undefined,
        department: params.department as string | undefined,
        is_primary: params.is_primary as boolean,
      }, { onConflict: 'person_id,organization_id' })
      .select()
      .single();

    if (error) throw new Error(`Failed to link person to organization: ${error.message}`);
    return JSON.stringify(data);
  },
});

// ── Search Tools ─────────────────────────────────────────────────────────────

defineTool({
  name: 'search.global',
  description: 'Search across all entity types (organizations, people, opportunities, RFPs, tasks) with a single query',
  minRole: 'viewer',
  parameters: z.object({
    query: z.string().min(1).max(200).describe('Search query string'),
    entity_types: z
      .array(z.enum(['organizations', 'people', 'opportunities', 'rfps', 'tasks']))
      .optional()
      .describe('Limit search to specific entity types. Omit to search all.'),
    limit: z.number().int().min(1).max(20).default(10).describe('Results per entity type'),
  }),
  handler: async (params, ctx) => {
    const { query, entity_types, limit = 10 } = params as {
      query: string; entity_types?: string[]; limit?: number;
    };
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
            .select('id, name, stage, amount')
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
    return JSON.stringify({ query, total_results: totalResults, results });
  },
});

// ── Opportunity Tools ────────────────────────────────────────────────────────

defineTool({
  name: 'opportunities.list',
  description: 'List and search opportunities/deals with pagination and filtering',
  minRole: 'viewer',
  parameters: z.object({
    page: z.number().int().min(1).default(1).describe('Page number'),
    limit: z.number().int().min(1).max(100).default(50).describe('Items per page'),
    search: z.string().optional().describe('Search by name'),
    stage: z.string().optional().describe('Filter by stage'),
    organization_id: z.string().uuid().optional().describe('Filter by organization'),
    sortBy: z.enum(['name', 'amount', 'stage', 'expected_close_date', 'created_at']).default('created_at'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
  handler: async (params, ctx) => {
    const { page = 1, limit = 50, search, stage, organization_id, sortBy = 'created_at', sortOrder = 'desc' } = params as Record<string, unknown>;
    const offset = ((page as number) - 1) * (limit as number);

    let query = ctx.supabase
      .from('opportunities')
      .select('*', { count: 'exact' })
      .eq('project_id', ctx.projectId)
      .is('deleted_at', null);

    if (search) {
      const sanitized = (search as string).replace(/[%_\\]/g, '\\$&');
      query = query.ilike('name', `%${sanitized}%`);
    }
    if (stage) query = query.eq('stage', stage as any);
    if (organization_id) query = query.eq('organization_id', organization_id as string);

    query = query.order(sortBy as 'name', { ascending: sortOrder === 'asc' });
    query = query.range(offset, offset + (limit as number) - 1);

    const { data, error, count } = await query;
    if (error) throw new Error(`Failed to list opportunities: ${error.message}`);

    return JSON.stringify({
      opportunities: data,
      pagination: { page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / (limit as number)) },
    });
  },
});

defineTool({
  name: 'opportunities.get',
  description: 'Get a single opportunity/deal by ID with full details',
  minRole: 'viewer',
  parameters: z.object({
    opportunity_id: z.string().uuid().describe('Opportunity ID'),
  }),
  handler: async (params, ctx) => {
    const { data, error } = await ctx.supabase
      .from('opportunities')
      .select('*')
      .eq('id', params.opportunity_id as string)
      .eq('project_id', ctx.projectId)
      .is('deleted_at', null)
      .single();

    if (error) throw new Error(`Opportunity not found: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'opportunities.create',
  description: 'Create a new opportunity/deal in the pipeline',
  minRole: 'member',
  parameters: z.object({
    name: z.string().min(1).max(200).describe('Opportunity name'),
    stage: z.string().optional().describe('Pipeline stage'),
    amount: z.number().min(0).nullable().optional().describe('Deal value'),
    probability: z.number().min(0).max(100).nullable().optional().describe('Win probability %'),
    currency: z.string().max(10).nullable().optional().describe('Currency code'),
    description: z.string().max(2000).nullable().optional(),
    organization_id: z.string().uuid().nullable().optional().describe('Linked organization'),
    primary_contact_id: z.string().uuid().nullable().optional().describe('Primary contact'),
    source: z.string().max(100).nullable().optional().describe('Lead source'),
    expected_close_date: z.string().nullable().optional().describe('Expected close date (YYYY-MM-DD)'),
    custom_fields: z.record(z.string(), z.unknown()).optional(),
  }),
  handler: async (params, ctx) => {
    const { custom_fields, ...rest } = params as Record<string, unknown>;
    const { data, error } = await ctx.supabase
      .from('opportunities')
      .insert({
        ...(rest as Record<string, unknown>),
        custom_fields: custom_fields as unknown as Json,
        project_id: ctx.projectId,
        created_by: ctx.userId,
        owner_id: ctx.userId,
      } as any)
      .select()
      .single();

    if (error) throw new Error(`Failed to create opportunity: ${error.message}`);

    emitAutomationEvent({
      projectId: ctx.projectId,
      triggerType: 'entity.created',
      entityType: 'opportunity',
      entityId: data.id,
      data: data as Record<string, unknown>,
    });

    return JSON.stringify(data);
  },
});

defineTool({
  name: 'opportunities.update',
  description: 'Update an existing opportunity/deal',
  minRole: 'member',
  parameters: z.object({
    opportunity_id: z.string().uuid().describe('Opportunity ID'),
    name: z.string().min(1).max(200).optional(),
    stage: z.string().optional(),
    amount: z.number().min(0).nullable().optional(),
    probability: z.number().min(0).max(100).nullable().optional(),
    description: z.string().max(2000).nullable().optional(),
    organization_id: z.string().uuid().nullable().optional(),
    primary_contact_id: z.string().uuid().nullable().optional(),
    expected_close_date: z.string().nullable().optional(),
    lost_reason: z.string().max(500).nullable().optional(),
    won_reason: z.string().max(500).nullable().optional(),
    custom_fields: z.record(z.string(), z.unknown()).optional(),
  }),
  handler: async (params, ctx) => {
    const { opportunity_id: id, custom_fields: cf, ...updates } = params as Record<string, unknown>;
    const updateData = cf !== undefined ? { ...updates, custom_fields: cf as unknown as Json } : updates;

    const { data, error } = await ctx.supabase
      .from('opportunities')
      .update(updateData as Record<string, unknown>)
      .eq('id', id as string)
      .eq('project_id', ctx.projectId)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) throw new Error(`Failed to update opportunity: ${error.message}`);

    emitAutomationEvent({
      projectId: ctx.projectId,
      triggerType: 'entity.updated',
      entityType: 'opportunity',
      entityId: data.id,
      data: data as Record<string, unknown>,
    });

    return JSON.stringify(data);
  },
});

defineTool({
  name: 'opportunities.delete',
  description: 'Soft-delete an opportunity/deal',
  minRole: 'member',
  parameters: z.object({
    opportunity_id: z.string().uuid().describe('Opportunity ID'),
  }),
  handler: async (params, ctx) => {
    const { data, error } = await ctx.supabase
      .from('opportunities')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', params.opportunity_id as string)
      .eq('project_id', ctx.projectId)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) throw new Error(`Failed to delete opportunity: ${error.message}`);
    return JSON.stringify({ deleted: true, id: data.id });
  },
});

// ── Task Tools ──────────────────────────────────────────────────────────────

defineTool({
  name: 'tasks.list',
  description: 'List and filter tasks with pagination',
  minRole: 'viewer',
  parameters: z.object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(50),
    status: z.string().optional().describe('Filter by status (e.g. pending, in_progress, completed)'),
    priority: z.string().optional().describe('Filter by priority (e.g. low, medium, high, urgent)'),
    assigned_to: z.string().uuid().optional().describe('Filter by assigned user ID'),
    organization_id: z.string().uuid().optional().describe('Filter by organization'),
    person_id: z.string().uuid().optional().describe('Filter by person'),
    opportunity_id: z.string().uuid().optional().describe('Filter by opportunity'),
    sortBy: z.enum(['title', 'status', 'priority', 'due_date', 'created_at']).default('created_at'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
  handler: async (params, ctx) => {
    const { page = 1, limit = 50, status, priority, assigned_to, organization_id, person_id, opportunity_id, sortBy = 'created_at', sortOrder = 'desc' } = params as Record<string, unknown>;
    const offset = ((page as number) - 1) * (limit as number);

    let query = ctx.supabase
      .from('tasks')
      .select('*', { count: 'exact' })
      .eq('project_id', ctx.projectId);

    if (status) query = query.eq('status', status as string);
    if (priority) query = query.eq('priority', priority as string);
    if (assigned_to) query = query.eq('assigned_to', assigned_to as string);
    if (organization_id) query = query.eq('organization_id', organization_id as string);
    if (person_id) query = query.eq('person_id', person_id as string);
    if (opportunity_id) query = query.eq('opportunity_id', opportunity_id as string);

    query = query.order(sortBy as 'title', { ascending: sortOrder === 'asc' });
    query = query.range(offset, offset + (limit as number) - 1);

    const { data, error, count } = await query;
    if (error) throw new Error(`Failed to list tasks: ${error.message}`);

    return JSON.stringify({ tasks: data, pagination: { page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / (limit as number)) } });
  },
});

defineTool({
  name: 'tasks.get',
  description: 'Get a single task by ID',
  minRole: 'viewer',
  parameters: z.object({ task_id: z.string().uuid().describe('Task ID') }),
  handler: async (params, ctx) => {
    const { data, error } = await ctx.supabase.from('tasks').select('*').eq('id', params.task_id as string).eq('project_id', ctx.projectId).single();
    if (error) throw new Error(`Task not found: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'tasks.create',
  description: 'Create a new task',
  minRole: 'member',
  parameters: z.object({
    title: z.string().min(1).max(500).describe('Task title'),
    description: z.string().max(5000).nullable().optional(),
    status: z.string().default('pending').describe('Task status'),
    priority: z.string().default('medium').describe('Task priority'),
    assigned_to: z.string().uuid().nullable().optional().describe('Assign to user ID'),
    due_date: z.string().nullable().optional().describe('Due date (YYYY-MM-DD)'),
    organization_id: z.string().uuid().nullable().optional(),
    person_id: z.string().uuid().nullable().optional(),
    opportunity_id: z.string().uuid().nullable().optional(),
    rfp_id: z.string().uuid().nullable().optional(),
  }),
  handler: async (params, ctx) => {
    const { data, error } = await ctx.supabase.from('tasks').insert({
      ...(params as Record<string, unknown>),
      project_id: ctx.projectId,
      created_by: ctx.userId,
    } as any).select().single();

    if (error) throw new Error(`Failed to create task: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'tasks.update',
  description: 'Update an existing task',
  minRole: 'member',
  parameters: z.object({
    task_id: z.string().uuid().describe('Task ID'),
    title: z.string().min(1).max(500).optional(),
    description: z.string().max(5000).nullable().optional(),
    status: z.string().optional(),
    priority: z.string().optional(),
    assigned_to: z.string().uuid().nullable().optional(),
    due_date: z.string().nullable().optional(),
    completed_at: z.string().nullable().optional().describe('Set completion timestamp'),
  }),
  handler: async (params, ctx) => {
    const { task_id: id, ...updates } = params as Record<string, unknown>;
    const { data, error } = await ctx.supabase.from('tasks').update(updates as Record<string, unknown>).eq('id', id as string).eq('project_id', ctx.projectId).select().single();
    if (error) throw new Error(`Failed to update task: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'tasks.delete',
  description: 'Delete a task',
  minRole: 'member',
  parameters: z.object({ task_id: z.string().uuid().describe('Task ID') }),
  handler: async (params, ctx) => {
    const { error } = await ctx.supabase.from('tasks').delete().eq('id', params.task_id as string).eq('project_id', ctx.projectId);
    if (error) throw new Error(`Failed to delete task: ${error.message}`);
    return JSON.stringify({ deleted: true, id: params.task_id });
  },
});

// ── Note Tools ──────────────────────────────────────────────────────────────

defineTool({
  name: 'notes.list',
  description: 'List notes for an entity (organization, person, opportunity, or RFP)',
  minRole: 'viewer',
  parameters: z.object({
    organization_id: z.string().uuid().optional().describe('Filter by organization'),
    person_id: z.string().uuid().optional().describe('Filter by person'),
    opportunity_id: z.string().uuid().optional().describe('Filter by opportunity'),
    rfp_id: z.string().uuid().optional().describe('Filter by RFP'),
    limit: z.number().int().min(1).max(100).default(20),
  }),
  handler: async (params, ctx) => {
    const { organization_id, person_id, opportunity_id, rfp_id, limit = 20 } = params as Record<string, unknown>;

    let query = ctx.supabase.from('notes').select('*').eq('project_id', ctx.projectId).order('created_at', { ascending: false }).limit(limit as number);

    if (organization_id) query = query.eq('organization_id', organization_id as string);
    if (person_id) query = query.eq('person_id', person_id as string);
    if (opportunity_id) query = query.eq('opportunity_id', opportunity_id as string);
    if (rfp_id) query = query.eq('rfp_id', rfp_id as string);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to list notes: ${error.message}`);
    return JSON.stringify({ notes: data });
  },
});

defineTool({
  name: 'notes.create',
  description: 'Create a note on an entity (organization, person, opportunity, or RFP)',
  minRole: 'member',
  parameters: z.object({
    content: z.string().min(1).max(10000).describe('Note content (plain text)'),
    organization_id: z.string().uuid().nullable().optional(),
    person_id: z.string().uuid().nullable().optional(),
    opportunity_id: z.string().uuid().nullable().optional(),
    rfp_id: z.string().uuid().nullable().optional(),
    is_pinned: z.boolean().default(false).describe('Pin the note'),
  }),
  handler: async (params, ctx) => {
    const { data, error } = await ctx.supabase.from('notes').insert({
      ...(params as Record<string, unknown>),
      project_id: ctx.projectId,
      created_by: ctx.userId,
    } as any).select().single();

    if (error) throw new Error(`Failed to create note: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'notes.update',
  description: 'Update a note',
  minRole: 'member',
  parameters: z.object({
    note_id: z.string().uuid().describe('Note ID'),
    content: z.string().min(1).max(10000).optional(),
    is_pinned: z.boolean().optional(),
  }),
  handler: async (params, ctx) => {
    const { note_id: id, ...updates } = params as Record<string, unknown>;
    const { data, error } = await ctx.supabase.from('notes').update(updates as Record<string, unknown>).eq('id', id as string).eq('project_id', ctx.projectId).select().single();
    if (error) throw new Error(`Failed to update note: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'notes.delete',
  description: 'Delete a note',
  minRole: 'member',
  parameters: z.object({ note_id: z.string().uuid().describe('Note ID') }),
  handler: async (params, ctx) => {
    const { error } = await ctx.supabase.from('notes').delete().eq('id', params.note_id as string).eq('project_id', ctx.projectId);
    if (error) throw new Error(`Failed to delete note: ${error.message}`);
    return JSON.stringify({ deleted: true, id: params.note_id });
  },
});

// ── Tag Tools ───────────────────────────────────────────────────────────────

defineTool({
  name: 'tags.list',
  description: 'List all tags in the project',
  minRole: 'viewer',
  parameters: z.object({}),
  handler: async (_params, ctx) => {
    const { data, error } = await ctx.supabase.from('entity_tags').select('*').eq('project_id', ctx.projectId).order('name');
    if (error) throw new Error(`Failed to list tags: ${error.message}`);
    return JSON.stringify({ tags: data });
  },
});

defineTool({
  name: 'tags.create',
  description: 'Create a new tag',
  minRole: 'member',
  parameters: z.object({
    name: z.string().min(1).max(100).describe('Tag name'),
    color: z.string().max(20).nullable().optional().describe('Tag color (hex or name)'),
  }),
  handler: async (params, ctx) => {
    const { data, error } = await ctx.supabase.from('entity_tags').insert({
      name: params.name as string,
      color: params.color as string | null,
      project_id: ctx.projectId,
    }).select().single();

    if (error) throw new Error(`Failed to create tag: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'tags.assign',
  description: 'Assign a tag to an entity (organization, person, opportunity, etc.)',
  minRole: 'member',
  parameters: z.object({
    tag_id: z.string().uuid().describe('Tag ID'),
    entity_id: z.string().uuid().describe('Entity ID to tag'),
    entity_type: z.string().describe('Entity type (organization, person, opportunity, rfp, task)'),
  }),
  handler: async (params, ctx) => {
    const { data, error } = await ctx.supabase.from('entity_tag_assignments').insert({
      tag_id: params.tag_id as string,
      entity_id: params.entity_id as string,
      entity_type: params.entity_type as string,
    }).select().single();

    if (error) throw new Error(`Failed to assign tag: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'tags.get_entity_tags',
  description: 'Get all tags assigned to a specific entity',
  minRole: 'viewer',
  parameters: z.object({
    entity_id: z.string().uuid().describe('Entity ID'),
    entity_type: z.string().describe('Entity type'),
  }),
  handler: async (params, ctx) => {
    const { data: assignments, error: aErr } = await ctx.supabase
      .from('entity_tag_assignments')
      .select('tag_id')
      .eq('entity_id', params.entity_id as string)
      .eq('entity_type', params.entity_type as string);

    if (aErr) throw new Error(`Failed to get tag assignments: ${aErr.message}`);
    if (!assignments || assignments.length === 0) return JSON.stringify({ tags: [] });

    const tagIds = assignments.map((a) => a.tag_id);
    const { data: tags, error } = await ctx.supabase.from('entity_tags').select('*').in('id', tagIds);
    if (error) throw new Error(`Failed to get tags: ${error.message}`);
    return JSON.stringify({ tags });
  },
});

// ── Comment Tools ───────────────────────────────────────────────────────────

defineTool({
  name: 'comments.list',
  description: 'List comments on an entity',
  minRole: 'viewer',
  parameters: z.object({
    entity_id: z.string().uuid().describe('Entity ID'),
    entity_type: z.string().describe('Entity type (organization, person, opportunity, rfp, task)'),
    limit: z.number().int().min(1).max(50).default(20),
  }),
  handler: async (params, ctx) => {
    const { data, error } = await ctx.supabase
      .from('entity_comments')
      .select('*')
      .eq('entity_id', params.entity_id as string)
      .eq('entity_type', params.entity_type as string)
      .eq('project_id', ctx.projectId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(params.limit as number ?? 20);

    if (error) throw new Error(`Failed to list comments: ${error.message}`);
    return JSON.stringify({ comments: data });
  },
});

defineTool({
  name: 'comments.create',
  description: 'Add a comment to an entity',
  minRole: 'member',
  parameters: z.object({
    content: z.string().min(1).max(5000).describe('Comment text'),
    entity_id: z.string().uuid().describe('Entity ID'),
    entity_type: z.string().describe('Entity type (organization, person, opportunity, rfp, task)'),
  }),
  handler: async (params, ctx) => {
    const { data, error } = await ctx.supabase.from('entity_comments').insert({
      content: params.content as string,
      entity_id: params.entity_id as string,
      entity_type: params.entity_type as string,
      project_id: ctx.projectId,
      created_by: ctx.userId,
    }).select().single();

    if (error) throw new Error(`Failed to create comment: ${error.message}`);
    return JSON.stringify(data);
  },
});

// ── Email Tools ─────────────────────────────────────────────────────────────

defineTool({
  name: 'email.send',
  description: 'Send an email via Gmail. Requires a connected Gmail account. Always confirm with the user before sending.',
  minRole: 'member',
  parameters: z.object({
    to: z.union([z.string().email(), z.array(z.string().email())]).describe('Recipient email(s)'),
    subject: z.string().min(1).max(998).describe('Email subject'),
    body_html: z.string().min(1).max(100000).describe('Email body in HTML'),
    cc: z.array(z.string().email()).optional().describe('CC recipients'),
    bcc: z.array(z.string().email()).optional().describe('BCC recipients'),
    person_id: z.string().uuid().optional().describe('Link email to a person'),
    organization_id: z.string().uuid().optional().describe('Link email to an organization'),
    opportunity_id: z.string().uuid().optional().describe('Link email to an opportunity'),
  }),
  handler: async (params, ctx) => {
    // Find the user's Gmail connection
    const { data: connections } = await ctx.supabase
      .from('gmail_connections')
      .select('id, email_address')
      .eq('user_id', ctx.userId)
      .limit(1);

    if (!connections || connections.length === 0) {
      throw new Error('No Gmail account connected. Please connect your Gmail in Settings first.');
    }

    // We need to call the email send API internally
    // For safety, we format the request and call the service directly
    const { sendEmail } = await import('@/lib/gmail/service');
    const { getDefaultSignature, appendSignatureToHtml } = await import('@/lib/signatures/get-default');

    const connection = connections[0];
    const to = params.to as string | string[];
    let bodyHtml = params.body_html as string;

    // Append signature if available
    const signature = await getDefaultSignature(ctx.supabase, ctx.userId, ctx.projectId);
    if (signature?.content_html) {
      bodyHtml = appendSignatureToHtml(bodyHtml, signature.content_html);
    }

    const result = await sendEmail(
      connection as any,
      {
        to: Array.isArray(to) ? to : [to],
        subject: params.subject as string,
        body_html: bodyHtml,
        cc: params.cc as string[] | undefined,
        bcc: params.bcc as string[] | undefined,
      },
      ctx.userId,
      ctx.projectId,
      signature?.sender_name,
    );

    return JSON.stringify({ sent: true, message_id: result.message_id, thread_id: result.thread_id });
  },
});

defineTool({
  name: 'email.history',
  description: 'Get email history for a person or organization',
  minRole: 'viewer',
  parameters: z.object({
    person_id: z.string().uuid().optional().describe('Filter by person'),
    organization_id: z.string().uuid().optional().describe('Filter by organization'),
    limit: z.number().int().min(1).max(50).default(20),
  }),
  handler: async (params, ctx) => {
    const { person_id, organization_id, limit = 20 } = params as Record<string, unknown>;

    let query = ctx.supabase
      .from('sent_emails')
      .select('id, to_email, subject, status, sent_at, opened_at, clicked_at')
      .eq('project_id', ctx.projectId)
      .order('sent_at', { ascending: false })
      .limit(limit as number);

    if (person_id) query = query.eq('person_id', person_id as string);
    if (organization_id) query = query.eq('organization_id', organization_id as string);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to get email history: ${error.message}`);
    return JSON.stringify({ emails: data });
  },
});

// ── RFP Tools ───────────────────────────────────────────────────────────────

defineTool({
  name: 'rfps.list',
  description: 'List RFPs (Request for Proposals) with filtering',
  minRole: 'viewer',
  parameters: z.object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(50),
    search: z.string().optional().describe('Search by title'),
    status: z.string().optional().describe('Filter by RFP status'),
    organization_id: z.string().uuid().optional(),
    sortBy: z.enum(['title', 'status', 'due_date', 'estimated_value', 'created_at']).default('created_at'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
  handler: async (params, ctx) => {
    const { page = 1, limit = 50, search, status, organization_id, sortBy = 'created_at', sortOrder = 'desc' } = params as Record<string, unknown>;
    const offset = ((page as number) - 1) * (limit as number);

    let query = ctx.supabase.from('rfps').select('*', { count: 'exact' }).eq('project_id', ctx.projectId).is('deleted_at', null);

    if (search) query = query.ilike('title', `%${(search as string).replace(/[%_\\]/g, '\\$&')}%`);
    if (status) query = query.eq('status', status as any);
    if (organization_id) query = query.eq('organization_id', organization_id as string);

    query = query.order(sortBy as 'title', { ascending: sortOrder === 'asc' });
    query = query.range(offset, offset + (limit as number) - 1);

    const { data, error, count } = await query;
    if (error) throw new Error(`Failed to list RFPs: ${error.message}`);
    return JSON.stringify({ rfps: data, pagination: { page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / (limit as number)) } });
  },
});

defineTool({
  name: 'rfps.get',
  description: 'Get a single RFP by ID with full details',
  minRole: 'viewer',
  parameters: z.object({ rfp_id: z.string().uuid().describe('RFP ID') }),
  handler: async (params, ctx) => {
    const { data, error } = await ctx.supabase.from('rfps').select('*').eq('id', params.rfp_id as string).eq('project_id', ctx.projectId).is('deleted_at', null).single();
    if (error) throw new Error(`RFP not found: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'rfps.create',
  description: 'Create a new RFP',
  minRole: 'member',
  parameters: z.object({
    title: z.string().min(1).max(500).describe('RFP title'),
    description: z.string().max(5000).nullable().optional(),
    status: z.string().optional().describe('RFP status'),
    rfp_number: z.string().max(100).nullable().optional(),
    organization_id: z.string().uuid().nullable().optional(),
    opportunity_id: z.string().uuid().nullable().optional(),
    due_date: z.string().nullable().optional().describe('Submission due date'),
    estimated_value: z.number().min(0).nullable().optional(),
    custom_fields: z.record(z.string(), z.unknown()).optional(),
  }),
  handler: async (params, ctx) => {
    const { custom_fields, ...rest } = params as Record<string, unknown>;
    const { data, error } = await ctx.supabase.from('rfps').insert({
      ...(rest as Record<string, unknown>),
      custom_fields: custom_fields as unknown as Json,
      project_id: ctx.projectId,
      created_by: ctx.userId,
      owner_id: ctx.userId,
    } as any).select().single();

    if (error) throw new Error(`Failed to create RFP: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'rfps.update',
  description: 'Update an existing RFP',
  minRole: 'member',
  parameters: z.object({
    rfp_id: z.string().uuid().describe('RFP ID'),
    title: z.string().min(1).max(500).optional(),
    description: z.string().max(5000).nullable().optional(),
    status: z.string().optional(),
    due_date: z.string().nullable().optional(),
    estimated_value: z.number().min(0).nullable().optional(),
    go_no_go_decision: z.string().nullable().optional(),
    go_no_go_notes: z.string().nullable().optional(),
    outcome_reason: z.string().nullable().optional(),
    custom_fields: z.record(z.string(), z.unknown()).optional(),
  }),
  handler: async (params, ctx) => {
    const { rfp_id: id, custom_fields: cf, ...updates } = params as Record<string, unknown>;
    const updateData = cf !== undefined ? { ...updates, custom_fields: cf as unknown as Json } : updates;

    const { data, error } = await ctx.supabase.from('rfps').update(updateData as Record<string, unknown>).eq('id', id as string).eq('project_id', ctx.projectId).is('deleted_at', null).select().single();
    if (error) throw new Error(`Failed to update RFP: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'rfps.delete',
  description: 'Soft-delete an RFP',
  minRole: 'member',
  parameters: z.object({ rfp_id: z.string().uuid().describe('RFP ID') }),
  handler: async (params, ctx) => {
    const { data, error } = await ctx.supabase.from('rfps').update({ deleted_at: new Date().toISOString() }).eq('id', params.rfp_id as string).eq('project_id', ctx.projectId).is('deleted_at', null).select().single();
    if (error) throw new Error(`Failed to delete RFP: ${error.message}`);
    return JSON.stringify({ deleted: true, id: data.id });
  },
});

// ── Sequence Tools ──────────────────────────────────────────────────────────

defineTool({
  name: 'sequences.list',
  description: 'List email sequences/campaigns',
  minRole: 'viewer',
  parameters: z.object({
    status: z.string().optional().describe('Filter by status (draft, active, paused, completed)'),
    limit: z.number().int().min(1).max(100).default(50),
  }),
  handler: async (params, ctx) => {
    let query = ctx.supabase.from('sequences').select('*').eq('project_id', ctx.projectId).order('created_at', { ascending: false }).limit(params.limit as number ?? 50);

    if (params.status) query = query.eq('status', params.status as string);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to list sequences: ${error.message}`);
    return JSON.stringify({ sequences: data });
  },
});

defineTool({
  name: 'sequences.get',
  description: 'Get a sequence with its steps and enrollment stats',
  minRole: 'viewer',
  parameters: z.object({ sequence_id: z.string().uuid().describe('Sequence ID') }),
  handler: async (params, ctx) => {
    const { data: seq, error } = await ctx.supabase.from('sequences').select('*').eq('id', params.sequence_id as string).eq('project_id', ctx.projectId).single();
    if (error) throw new Error(`Sequence not found: ${error.message}`);

    const { data: steps } = await ctx.supabase.from('sequence_steps').select('*').eq('sequence_id', params.sequence_id as string).order('step_order', { ascending: true });

    const { count: enrollmentCount } = await ctx.supabase.from('sequence_enrollments').select('*', { count: 'exact', head: true }).eq('sequence_id', params.sequence_id as string);

    return JSON.stringify({ sequence: seq, steps: steps ?? [], enrollment_count: enrollmentCount ?? 0 });
  },
});

defineTool({
  name: 'sequences.create',
  description: 'Create a new email sequence',
  minRole: 'member',
  parameters: z.object({
    name: z.string().min(1).max(200).describe('Sequence name'),
    description: z.string().max(2000).nullable().optional(),
    status: z.string().default('draft').describe('Sequence status'),
  }),
  handler: async (params, ctx) => {
    const { data, error } = await ctx.supabase.from('sequences').insert({
      name: params.name as string,
      description: params.description as string | null,
      status: params.status as string ?? 'draft',
      project_id: ctx.projectId,
      created_by: ctx.userId,
    }).select().single();

    if (error) throw new Error(`Failed to create sequence: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'sequences.update',
  description: 'Update a sequence',
  minRole: 'member',
  parameters: z.object({
    sequence_id: z.string().uuid().describe('Sequence ID'),
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).nullable().optional(),
    status: z.string().optional(),
  }),
  handler: async (params, ctx) => {
    const { sequence_id: id, ...updates } = params as Record<string, unknown>;
    const { data, error } = await ctx.supabase.from('sequences').update(updates as Record<string, unknown>).eq('id', id as string).eq('project_id', ctx.projectId).select().single();
    if (error) throw new Error(`Failed to update sequence: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'sequences.enroll',
  description: 'Enroll a person into a sequence',
  minRole: 'member',
  parameters: z.object({
    sequence_id: z.string().uuid().describe('Sequence ID'),
    person_id: z.string().uuid().describe('Person ID to enroll'),
    gmail_connection_id: z.string().uuid().describe('Gmail connection to send from'),
  }),
  handler: async (params, ctx) => {
    const { data, error } = await ctx.supabase.from('sequence_enrollments').insert({
      sequence_id: params.sequence_id as string,
      person_id: params.person_id as string,
      gmail_connection_id: params.gmail_connection_id as string,
      created_by: ctx.userId,
      status: 'active',
      current_step: 0,
    }).select().single();

    if (error) throw new Error(`Failed to enroll person: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'sequences.unenroll',
  description: 'Remove a person from a sequence',
  minRole: 'member',
  parameters: z.object({
    enrollment_id: z.string().uuid().describe('Enrollment ID'),
  }),
  handler: async (params, ctx) => {
    const { data, error } = await ctx.supabase.from('sequence_enrollments')
      .update({ status: 'cancelled' })
      .eq('id', params.enrollment_id as string)
      .select('sequence_id')
      .single();

    if (error) throw new Error(`Failed to unenroll: ${error.message}`);
    return JSON.stringify({ unenrolled: true, id: params.enrollment_id, sequence_id: data.sequence_id });
  },
});

// ── Meeting Tools ───────────────────────────────────────────────────────────

defineTool({
  name: 'meetings.list',
  description: 'List meetings with filtering',
  minRole: 'viewer',
  parameters: z.object({
    status: z.string().optional().describe('Filter by status (scheduled, completed, cancelled)'),
    organization_id: z.string().uuid().optional(),
    person_id: z.string().uuid().optional(),
    from_date: z.string().optional().describe('Start date filter (YYYY-MM-DD)'),
    to_date: z.string().optional().describe('End date filter (YYYY-MM-DD)'),
    limit: z.number().int().min(1).max(100).default(20),
  }),
  handler: async (params, ctx) => {
    const { status, organization_id, person_id, from_date, to_date, limit = 20 } = params as Record<string, unknown>;

    let query = ctx.supabase.from('meetings').select('*').eq('project_id', ctx.projectId).order('scheduled_at', { ascending: false }).limit(limit as number);

    if (status) query = query.eq('status', status as string);
    if (organization_id) query = query.eq('organization_id', organization_id as string);
    if (person_id) query = query.eq('person_id', person_id as string);
    if (from_date) query = query.gte('scheduled_at', from_date as string);
    if (to_date) query = query.lte('scheduled_at', to_date as string);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to list meetings: ${error.message}`);
    return JSON.stringify({ meetings: data });
  },
});

defineTool({
  name: 'meetings.create',
  description: 'Schedule a new meeting',
  minRole: 'member',
  parameters: z.object({
    title: z.string().min(1).max(500).describe('Meeting title'),
    description: z.string().max(5000).nullable().optional(),
    meeting_type: z.string().default('call').describe('Type: call, video, in_person'),
    scheduled_at: z.string().describe('Meeting date/time (ISO 8601)'),
    duration_minutes: z.number().int().min(5).max(480).default(30),
    location: z.string().max(500).nullable().optional(),
    meeting_url: z.string().url().max(500).nullable().optional(),
    organization_id: z.string().uuid().nullable().optional(),
    person_id: z.string().uuid().nullable().optional(),
    opportunity_id: z.string().uuid().nullable().optional(),
  }),
  handler: async (params, ctx) => {
    const { data, error } = await ctx.supabase.from('meetings').insert({
      ...(params as Record<string, unknown>),
      project_id: ctx.projectId,
      created_by: ctx.userId,
      assigned_to: ctx.userId,
      status: 'scheduled',
    } as any).select().single();

    if (error) throw new Error(`Failed to create meeting: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'meetings.update',
  description: 'Update a meeting',
  minRole: 'member',
  parameters: z.object({
    meeting_id: z.string().uuid().describe('Meeting ID'),
    title: z.string().min(1).max(500).optional(),
    status: z.string().optional(),
    scheduled_at: z.string().optional(),
    duration_minutes: z.number().int().min(5).max(480).optional(),
    outcome: z.string().nullable().optional(),
    outcome_notes: z.string().max(5000).nullable().optional(),
    next_steps: z.string().max(5000).nullable().optional(),
  }),
  handler: async (params, ctx) => {
    const { meeting_id: id, ...updates } = params as Record<string, unknown>;
    const { data, error } = await ctx.supabase.from('meetings').update(updates as Record<string, unknown>).eq('id', id as string).eq('project_id', ctx.projectId).select().single();
    if (error) throw new Error(`Failed to update meeting: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'meetings.delete',
  description: 'Delete a meeting',
  minRole: 'member',
  parameters: z.object({ meeting_id: z.string().uuid().describe('Meeting ID') }),
  handler: async (params, ctx) => {
    const { error } = await ctx.supabase.from('meetings').delete().eq('id', params.meeting_id as string).eq('project_id', ctx.projectId);
    if (error) throw new Error(`Failed to delete meeting: ${error.message}`);
    return JSON.stringify({ deleted: true, id: params.meeting_id });
  },
});

// ── Call Tools ───────────────────────────────────────────────────────────────

defineTool({
  name: 'calls.list',
  description: 'List call history with filtering',
  minRole: 'viewer',
  parameters: z.object({
    person_id: z.string().uuid().optional(),
    organization_id: z.string().uuid().optional(),
    direction: z.enum(['inbound', 'outbound']).optional(),
    limit: z.number().int().min(1).max(100).default(20),
  }),
  handler: async (params, ctx) => {
    const { person_id, organization_id, direction, limit = 20 } = params as Record<string, unknown>;

    let query = ctx.supabase.from('calls').select('id, from_number, to_number, direction, status, started_at, duration_seconds, disposition, disposition_notes, person_id, organization_id')
      .eq('project_id', ctx.projectId)
      .order('started_at', { ascending: false })
      .limit(limit as number);

    if (person_id) query = query.eq('person_id', person_id as string);
    if (organization_id) query = query.eq('organization_id', organization_id as string);
    if (direction) query = query.eq('direction', direction as string);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to list calls: ${error.message}`);
    return JSON.stringify({ calls: data });
  },
});

defineTool({
  name: 'calls.get',
  description: 'Get call details including transcription',
  minRole: 'viewer',
  parameters: z.object({ id: z.string().uuid().describe('Call ID') }),
  handler: async (params, ctx) => {
    const { data, error } = await ctx.supabase.from('calls').select('*').eq('id', params.id as string).eq('project_id', ctx.projectId).single();
    if (error) throw new Error(`Call not found: ${error.message}`);
    return JSON.stringify(data);
  },
});

// ── Dashboard Tools ─────────────────────────────────────────────────────────

defineTool({
  name: 'dashboard.stats',
  description: 'Get dashboard statistics: entity counts, pipeline value, recent activity',
  minRole: 'viewer',
  parameters: z.object({}),
  handler: async (_params, ctx) => {
    const [orgs, people, opps, tasks, rfps] = await Promise.all([
      ctx.supabase.from('organizations').select('*', { count: 'exact', head: true }).eq('project_id', ctx.projectId).is('deleted_at', null),
      ctx.supabase.from('people').select('*', { count: 'exact', head: true }).eq('project_id', ctx.projectId).is('deleted_at', null),
      ctx.supabase.from('opportunities').select('id, amount, stage').eq('project_id', ctx.projectId).is('deleted_at', null),
      ctx.supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('project_id', ctx.projectId).neq('status', 'completed'),
      ctx.supabase.from('rfps').select('*', { count: 'exact', head: true }).eq('project_id', ctx.projectId).is('deleted_at', null),
    ]);

    const opportunities = opps.data ?? [];
    const totalPipeline = opportunities.reduce((sum, o) => sum + ((o.amount as number) ?? 0), 0);
    const stageBreakdown: Record<string, { count: number; value: number }> = {};
    for (const o of opportunities) {
      const stage = (o.stage as string) ?? 'unknown';
      if (!stageBreakdown[stage]) stageBreakdown[stage] = { count: 0, value: 0 };
      stageBreakdown[stage].count++;
      stageBreakdown[stage].value += (o.amount as number) ?? 0;
    }

    return JSON.stringify({
      counts: {
        organizations: orgs.count ?? 0,
        people: people.count ?? 0,
        opportunities: opportunities.length,
        open_tasks: tasks.count ?? 0,
        rfps: rfps.count ?? 0,
      },
      pipeline: {
        total_value: totalPipeline,
        deal_count: opportunities.length,
        by_stage: stageBreakdown,
      },
    });
  },
});

// ── Automations Tools ────────────────────────────────────────────────────────

defineTool({
  name: 'automations.list',
  description: 'List automations with optional filtering by active status',
  minRole: 'viewer',
  parameters: z.object({
    is_active: z.boolean().optional().describe('Filter by active status'),
    limit: z.number().int().min(1).max(100).default(50).describe('Items per page'),
    offset: z.number().int().min(0).default(0).describe('Offset for pagination'),
  }),
  handler: async (params, ctx) => {
    const { is_active, limit = 50, offset = 0 } = params as { is_active?: boolean; limit?: number; offset?: number };
    let query = ctx.supabase
      .from('automations')
      .select('*', { count: 'exact' })
      .eq('project_id', ctx.projectId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (is_active !== undefined) query = query.eq('is_active', is_active);
    const { data, error, count } = await query;
    if (error) throw new Error(`Failed to list automations: ${error.message}`);
    return JSON.stringify({ automations: data, pagination: { limit, offset, total: count ?? 0 } });
  },
});

defineTool({
  name: 'automations.get',
  description: 'Get a single automation by ID with recent executions',
  minRole: 'viewer',
  parameters: z.object({
    automation_id: z.string().uuid().describe('Automation ID'),
  }),
  handler: async (params, ctx) => {
    const { data, error } = await ctx.supabase
      .from('automations')
      .select('*')
      .eq('id', params.automation_id as string)
      .eq('project_id', ctx.projectId)
      .single();
    if (error) throw new Error(`Automation not found: ${error.message}`);

    const { data: executions } = await ctx.supabase
      .from('automation_executions')
      .select('*')
      .eq('automation_id', params.automation_id as string)
      .order('created_at', { ascending: false })
      .limit(10);

    return JSON.stringify({ automation: data, recent_executions: executions ?? [] });
  },
});

defineTool({
  name: 'automations.create',
  description: 'Create a new automation rule with trigger, conditions, and actions',
  minRole: 'admin',
  parameters: z.object({
    name: z.string().min(1).max(255).describe('Automation name'),
    description: z.string().max(1000).nullable().optional().describe('Description'),
    is_active: z.boolean().default(false).describe('Whether automation is active'),
    trigger_type: z.string().describe('Trigger type (e.g. entity.created, entity.updated, entity.deleted)'),
    trigger_config: z.record(z.string(), z.unknown()).default({}).describe('Trigger configuration'),
    conditions: z.array(z.object({
      field: z.string(),
      operator: z.string(),
      value: z.unknown().optional(),
    })).default([]).describe('Conditions to match'),
    actions: z.array(z.object({
      type: z.string(),
      config: z.record(z.string(), z.unknown()).default({}),
    })).min(1).describe('Actions to execute'),
  }),
  handler: async (params, ctx) => {
    const { data, error } = await ctx.supabase
      .from('automations')
      .insert({
        ...params as any,
        project_id: ctx.projectId,
        created_by: ctx.userId,
      } as any)
      .select()
      .single();
    if (error) throw new Error(`Failed to create automation: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'automations.update',
  description: 'Update an existing automation',
  minRole: 'admin',
  parameters: z.object({
    automation_id: z.string().uuid().describe('Automation ID'),
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(1000).nullable().optional(),
    is_active: z.boolean().optional(),
    trigger_type: z.string().optional(),
    trigger_config: z.record(z.string(), z.unknown()).optional(),
    conditions: z.array(z.object({
      field: z.string(),
      operator: z.string(),
      value: z.unknown().optional(),
    })).optional(),
    actions: z.array(z.object({
      type: z.string(),
      config: z.record(z.string(), z.unknown()).default({}),
    })).min(1).optional(),
  }),
  handler: async (params, ctx) => {
    const { automation_id: id, ...updates } = params as Record<string, unknown>;
    const { data, error } = await ctx.supabase
      .from('automations')
      .update(updates as any)
      .eq('id', id as string)
      .eq('project_id', ctx.projectId)
      .select()
      .single();
    if (error) throw new Error(`Failed to update automation: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'automations.delete',
  description: 'Delete an automation',
  minRole: 'admin',
  parameters: z.object({
    automation_id: z.string().uuid().describe('Automation ID'),
  }),
  handler: async (params, ctx) => {
    const { error } = await ctx.supabase
      .from('automations')
      .delete()
      .eq('id', params.automation_id as string)
      .eq('project_id', ctx.projectId);
    if (error) throw new Error(`Failed to delete automation: ${error.message}`);
    return JSON.stringify({ success: true });
  },
});

// ── Content Library Tools ───────────────────────────────────────────────────

defineTool({
  name: 'content.list',
  description: 'List content library entries with optional category and search filters',
  minRole: 'viewer',
  parameters: z.object({
    category: z.string().optional().describe('Filter by category'),
    search: z.string().max(500).optional().describe('Search query'),
  }),
  handler: async (params, ctx) => {
    const { category, search } = params as { category?: string; search?: string };
    let query = ctx.supabase
      .from('rfp_content_library')
      .select('*', { count: 'exact' })
      .eq('project_id', ctx.projectId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (category) query = query.eq('category', category);
    if (search) {
      const s = search.replace(/[%_\\]/g, '\\$&');
      query = query.or(`title.ilike."%${s}%",answer_text.ilike."%${s}%",question_text.ilike."%${s}%"`);
    }
    const { data, error, count } = await query;
    if (error) throw new Error(`Failed to list content: ${error.message}`);
    return JSON.stringify({ entries: data, total: count ?? 0 });
  },
});

defineTool({
  name: 'content.search',
  description: 'Semantic search of the content library for relevant answers',
  minRole: 'viewer',
  parameters: z.object({
    query: z.string().min(1).describe('Search query'),
    category: z.string().optional().describe('Filter by category'),
    limit: z.number().int().min(1).max(50).default(10).describe('Max results'),
  }),
  handler: async (params, ctx) => {
    const { query, category, limit = 10 } = params as { query: string; category?: string; limit?: number };
    let q = ctx.supabase
      .from('rfp_content_library')
      .select('*')
      .eq('project_id', ctx.projectId)
      .is('deleted_at', null)
      .limit(limit);
    if (category) q = q.eq('category', category);
    const s = query.replace(/[%_\\]/g, '\\$&');
    q = q.or(`title.ilike."%${s}%",answer_text.ilike."%${s}%",question_text.ilike."%${s}%"`);
    const { data, error } = await q;
    if (error) throw new Error(`Failed to search content: ${error.message}`);
    return JSON.stringify({ entries: data });
  },
});

defineTool({
  name: 'content.get',
  description: 'Get a single content library entry by ID',
  minRole: 'viewer',
  parameters: z.object({
    content_entry_id: z.string().uuid().describe('Content entry ID'),
  }),
  handler: async (params, ctx) => {
    const { data, error } = await ctx.supabase
      .from('rfp_content_library')
      .select('*')
      .eq('id', params.content_entry_id as string)
      .eq('project_id', ctx.projectId)
      .is('deleted_at', null)
      .single();
    if (error) throw new Error(`Content entry not found: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'content.create',
  description: 'Create a new content library entry (reusable answer/snippet)',
  minRole: 'member',
  parameters: z.object({
    title: z.string().min(1).max(500).describe('Entry title'),
    question_text: z.string().optional().describe('Original question text'),
    answer_text: z.string().min(1).describe('Answer/content text'),
    answer_html: z.string().optional().describe('HTML formatted answer'),
    category: z.string().optional().describe('Category'),
    tags: z.array(z.string()).optional().describe('Tags'),
  }),
  handler: async (params, ctx) => {
    const { data, error } = await ctx.supabase
      .from('rfp_content_library')
      .insert({
        ...params as any,
        project_id: ctx.projectId,
        created_by: ctx.userId,
      } as any)
      .select()
      .single();
    if (error) throw new Error(`Failed to create content entry: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'content.update',
  description: 'Update a content library entry',
  minRole: 'member',
  parameters: z.object({
    content_entry_id: z.string().uuid().describe('Content entry ID'),
    title: z.string().min(1).max(500).optional(),
    question_text: z.string().optional(),
    answer_text: z.string().optional(),
    answer_html: z.string().optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }),
  handler: async (params, ctx) => {
    const { content_entry_id: id, ...updates } = params as Record<string, unknown>;
    const { data, error } = await ctx.supabase
      .from('rfp_content_library')
      .update(updates as any)
      .eq('id', id as string)
      .eq('project_id', ctx.projectId)
      .select()
      .single();
    if (error) throw new Error(`Failed to update content entry: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'content.delete',
  description: 'Delete a content library entry (soft delete)',
  minRole: 'member',
  parameters: z.object({
    content_entry_id: z.string().uuid().describe('Content entry ID'),
  }),
  handler: async (params, ctx) => {
    const { error } = await ctx.supabase
      .from('rfp_content_library')
      .update({ deleted_at: new Date().toISOString() } as any)
      .eq('id', params.content_entry_id as string)
      .eq('project_id', ctx.projectId);
    if (error) throw new Error(`Failed to delete content entry: ${error.message}`);
    return JSON.stringify({ success: true });
  },
});

// ── News Tools ──────────────────────────────────────────────────────────────

defineTool({
  name: 'news.list_keywords',
  description: 'List news monitoring keywords for this project',
  minRole: 'viewer',
  parameters: z.object({
    source: z.string().optional().describe('Filter by source (manual or organization)'),
  }),
  handler: async (params, ctx) => {
    let query = ctx.supabase
      .from('news_keywords')
      .select('*')
      .eq('project_id', ctx.projectId)
      .order('created_at', { ascending: false });
    if (params.source) query = query.eq('source', params.source as string);
    const { data, error } = await query;
    if (error) throw new Error(`Failed to list keywords: ${error.message}`);
    return JSON.stringify({ keywords: data });
  },
});

defineTool({
  name: 'news.create_keyword',
  description: 'Add a news monitoring keyword to track',
  minRole: 'member',
  parameters: z.object({
    keyword: z.string().min(2).max(255).describe('Keyword to monitor'),
  }),
  handler: async (params, ctx) => {
    const { data, error } = await ctx.supabase
      .from('news_keywords')
      .insert({
        keyword: params.keyword as string,
        project_id: ctx.projectId,
        source: 'manual',
        created_by: ctx.userId,
      } as any)
      .select()
      .single();
    if (error) throw new Error(`Failed to create keyword: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'news.delete_keyword',
  description: 'Delete a news monitoring keyword',
  minRole: 'member',
  parameters: z.object({
    keyword_id: z.string().uuid().describe('Keyword ID'),
  }),
  handler: async (params, ctx) => {
    const { error } = await ctx.supabase
      .from('news_keywords')
      .delete()
      .eq('id', params.keyword_id as string)
      .eq('project_id', ctx.projectId)
      .eq('source', 'manual');
    if (error) throw new Error(`Failed to delete keyword: ${error.message}`);
    return JSON.stringify({ success: true });
  },
});

defineTool({
  name: 'news.list_articles',
  description: 'List news articles for this project, optionally filtered by keyword',
  minRole: 'viewer',
  parameters: z.object({
    keyword_id: z.string().uuid().optional().describe('Filter by keyword ID'),
    is_starred: z.boolean().optional().describe('Filter by starred status'),
    is_read: z.boolean().optional().describe('Filter by read status'),
    limit: z.number().int().min(1).max(100).default(50),
    offset: z.number().int().min(0).default(0),
  }),
  handler: async (params, ctx) => {
    const { keyword_id, is_starred, is_read, limit = 50, offset = 0 } = params as any;
    let query = ctx.supabase
      .from('news_articles')
      .select('*', { count: 'exact' })
      .eq('project_id', ctx.projectId)
      .order('published_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (keyword_id) query = query.eq('keyword_id', keyword_id);
    if (is_starred !== undefined) query = query.eq('is_starred', is_starred);
    if (is_read !== undefined) query = query.eq('is_read', is_read);
    const { data, error, count } = await query;
    if (error) throw new Error(`Failed to list articles: ${error.message}`);
    return JSON.stringify({ articles: data, pagination: { limit, offset, total: count ?? 0 } });
  },
});

defineTool({
  name: 'news.update_article',
  description: 'Update a news article (mark as read/starred)',
  minRole: 'member',
  parameters: z.object({
    article_id: z.string().uuid().describe('Article ID'),
    is_read: z.boolean().optional(),
    is_starred: z.boolean().optional(),
  }),
  handler: async (params, ctx) => {
    const { article_id: id, ...updates } = params as Record<string, unknown>;
    const { data, error } = await ctx.supabase
      .from('news_articles')
      .update(updates as any)
      .eq('id', id as string)
      .eq('project_id', ctx.projectId)
      .select()
      .single();
    if (error) throw new Error(`Failed to update article: ${error.message}`);
    return JSON.stringify(data);
  },
});

// ── Custom Fields / Schema Tools ────────────────────────────────────────────

defineTool({
  name: 'schema.list',
  description: 'List custom field definitions for this project, optionally filtered by entity type',
  minRole: 'viewer',
  parameters: z.object({
    entity_type: z.string().optional().describe('Filter by entity type (organization, person, opportunity, rfp, task)'),
  }),
  handler: async (params, ctx) => {
    let query = ctx.supabase
      .from('custom_field_definitions')
      .select('*')
      .eq('project_id', ctx.projectId)
      .order('display_order', { ascending: true });
    if (params.entity_type) query = query.eq('entity_type', params.entity_type as any);
    const { data, error } = await query;
    if (error) throw new Error(`Failed to list custom fields: ${error.message}`);
    return JSON.stringify({ fields: data });
  },
});

defineTool({
  name: 'schema.create',
  description: 'Create a new custom field definition',
  minRole: 'admin',
  parameters: z.object({
    name: z.string().min(1).max(100).describe('Field machine name'),
    label: z.string().min(1).max(200).describe('Display label'),
    description: z.string().max(500).optional(),
    entity_type: z.string().describe('Entity type (organization, person, opportunity, rfp, task)'),
    field_type: z.string().describe('Field type (text, number, date, boolean, select, multi_select, url, email, phone)'),
    is_required: z.boolean().default(false),
    is_searchable: z.boolean().default(false),
    is_filterable: z.boolean().default(false),
    is_visible_in_list: z.boolean().default(true),
    group_name: z.string().max(100).optional(),
    options: z.array(z.string()).optional().describe('Options for select/multi_select fields'),
    default_value: z.string().optional(),
  }),
  handler: async (params, ctx) => {
    const { data, error } = await ctx.supabase
      .from('custom_field_definitions')
      .insert({
        ...params as any,
        project_id: ctx.projectId,
        created_by: ctx.userId,
      } as any)
      .select()
      .single();
    if (error) throw new Error(`Failed to create custom field: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'schema.update',
  description: 'Update a custom field definition',
  minRole: 'admin',
  parameters: z.object({
    field_id: z.string().uuid().describe('Custom field ID'),
    label: z.string().min(1).max(200).optional(),
    description: z.string().max(500).optional(),
    is_required: z.boolean().optional(),
    is_searchable: z.boolean().optional(),
    is_filterable: z.boolean().optional(),
    is_visible_in_list: z.boolean().optional(),
    group_name: z.string().max(100).optional(),
    options: z.array(z.string()).optional(),
    default_value: z.string().optional(),
  }),
  handler: async (params, ctx) => {
    const { field_id: id, ...updates } = params as Record<string, unknown>;
    const { data, error } = await ctx.supabase
      .from('custom_field_definitions')
      .update(updates as any)
      .eq('id', id as string)
      .eq('project_id', ctx.projectId)
      .select()
      .single();
    if (error) throw new Error(`Failed to update custom field: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'schema.delete',
  description: 'Delete a custom field definition',
  minRole: 'admin',
  parameters: z.object({
    field_id: z.string().uuid().describe('Custom field ID'),
  }),
  handler: async (params, ctx) => {
    const { error } = await ctx.supabase
      .from('custom_field_definitions')
      .delete()
      .eq('id', params.field_id as string)
      .eq('project_id', ctx.projectId);
    if (error) throw new Error(`Failed to delete custom field: ${error.message}`);
    return JSON.stringify({ success: true });
  },
});

// ── Webhooks Tools ──────────────────────────────────────────────────────────

defineTool({
  name: 'webhooks.list',
  description: 'List webhooks configured for this project',
  minRole: 'admin',
  parameters: z.object({
    is_active: z.boolean().optional().describe('Filter by active status'),
    limit: z.number().int().min(1).max(100).default(50),
    offset: z.number().int().min(0).default(0),
  }),
  handler: async (params, ctx) => {
    const { is_active, limit = 50, offset = 0 } = params as any;
    let query = ctx.supabase
      .from('webhooks')
      .select('*', { count: 'exact' })
      .eq('project_id', ctx.projectId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (is_active !== undefined) query = query.eq('is_active', is_active);
    const { data, error, count } = await query;
    if (error) throw new Error(`Failed to list webhooks: ${error.message}`);
    return JSON.stringify({ webhooks: data, pagination: { limit, offset, total: count ?? 0 } });
  },
});

defineTool({
  name: 'webhooks.get',
  description: 'Get a single webhook by ID with delivery stats',
  minRole: 'admin',
  parameters: z.object({
    webhook_id: z.string().uuid().describe('Webhook ID'),
  }),
  handler: async (params, ctx) => {
    const { data, error } = await ctx.supabase
      .from('webhooks')
      .select('*')
      .eq('id', params.webhook_id as string)
      .eq('project_id', ctx.projectId)
      .single();
    if (error) throw new Error(`Webhook not found: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'webhooks.create',
  description: 'Create a new webhook endpoint',
  minRole: 'admin',
  parameters: z.object({
    name: z.string().min(1).max(255).describe('Webhook name'),
    url: z.string().url().describe('Webhook URL (must be https)'),
    events: z.array(z.string()).min(1).describe('Events to subscribe to'),
    is_active: z.boolean().default(true),
    retry_count: z.number().int().min(0).max(10).default(3),
    timeout_ms: z.number().int().min(1000).max(60000).default(10000),
    headers: z.record(z.string(), z.string()).optional().describe('Custom headers'),
  }),
  handler: async (params, ctx) => {
    const { data, error } = await ctx.supabase
      .from('webhooks')
      .insert({
        ...params as any,
        project_id: ctx.projectId,
        created_by: ctx.userId,
      } as any)
      .select()
      .single();
    if (error) throw new Error(`Failed to create webhook: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'webhooks.update',
  description: 'Update an existing webhook',
  minRole: 'admin',
  parameters: z.object({
    webhook_id: z.string().uuid().describe('Webhook ID'),
    name: z.string().min(1).max(255).optional(),
    url: z.string().url().optional(),
    events: z.array(z.string()).min(1).optional(),
    is_active: z.boolean().optional(),
    retry_count: z.number().int().min(0).max(10).optional(),
    timeout_ms: z.number().int().min(1000).max(60000).optional(),
    headers: z.record(z.string(), z.string()).optional(),
  }),
  handler: async (params, ctx) => {
    const { webhook_id: id, ...updates } = params as Record<string, unknown>;
    const { data, error } = await ctx.supabase
      .from('webhooks')
      .update(updates as any)
      .eq('id', id as string)
      .eq('project_id', ctx.projectId)
      .select()
      .single();
    if (error) throw new Error(`Failed to update webhook: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'webhooks.delete',
  description: 'Delete a webhook',
  minRole: 'admin',
  parameters: z.object({
    webhook_id: z.string().uuid().describe('Webhook ID'),
  }),
  handler: async (params, ctx) => {
    const { error } = await ctx.supabase
      .from('webhooks')
      .delete()
      .eq('id', params.webhook_id as string)
      .eq('project_id', ctx.projectId);
    if (error) throw new Error(`Failed to delete webhook: ${error.message}`);
    return JSON.stringify({ success: true });
  },
});

// ── Reports Tools ───────────────────────────────────────────────────────────

defineTool({
  name: 'reports.list',
  description: 'List saved reports',
  minRole: 'viewer',
  parameters: z.object({
    report_type: z.string().optional().describe('Filter by report type'),
    is_public: z.boolean().optional().describe('Filter by public/private'),
    limit: z.number().int().min(1).max(100).default(50),
    offset: z.number().int().min(0).default(0),
  }),
  handler: async (params, ctx) => {
    const { report_type, is_public, limit = 50, offset = 0 } = params as any;
    let query = ctx.supabase
      .from('report_definitions')
      .select('*', { count: 'exact' })
      .eq('project_id', ctx.projectId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (report_type) query = query.eq('report_type', report_type);
    if (is_public !== undefined) query = query.eq('is_public', is_public);
    const { data, error, count } = await query;
    if (error) throw new Error(`Failed to list reports: ${error.message}`);
    return JSON.stringify({ reports: data, pagination: { limit, offset, total: count ?? 0 } });
  },
});

defineTool({
  name: 'reports.get',
  description: 'Get a report by ID with recent run history',
  minRole: 'viewer',
  parameters: z.object({
    report_id: z.string().uuid().describe('Report ID'),
  }),
  handler: async (params, ctx) => {
    const { data, error } = await ctx.supabase
      .from('report_definitions')
      .select('*')
      .eq('id', params.report_id as string)
      .eq('project_id', ctx.projectId)
      .single();
    if (error) throw new Error(`Report not found: ${error.message}`);

    const { data: runs } = await ctx.supabase
      .from('report_runs')
      .select('*')
      .eq('report_id', params.report_id as string)
      .order('created_at', { ascending: false })
      .limit(10);

    return JSON.stringify({ report: data, runs: runs ?? [] });
  },
});

defineTool({
  name: 'reports.create',
  description: 'Create a new report definition',
  minRole: 'admin',
  parameters: z.object({
    name: z.string().min(1).max(255).describe('Report name'),
    description: z.string().max(1000).nullable().optional(),
    report_type: z.string().describe('Report type (pipeline, activity, conversion, custom)'),
    config: z.record(z.string(), z.unknown()).default({}).describe('Report configuration (chart_type, metrics, group_by, time_range)'),
    filters: z.record(z.string(), z.unknown()).default({}).describe('Report filters'),
    is_public: z.boolean().default(false),
  }),
  handler: async (params, ctx) => {
    const { data, error } = await ctx.supabase
      .from('report_definitions')
      .insert({
        ...params as any,
        project_id: ctx.projectId,
        created_by: ctx.userId,
      } as any)
      .select()
      .single();
    if (error) throw new Error(`Failed to create report: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'reports.delete',
  description: 'Delete a saved report',
  minRole: 'admin',
  parameters: z.object({
    report_id: z.string().uuid().describe('Report ID'),
  }),
  handler: async (params, ctx) => {
    const { error } = await ctx.supabase
      .from('report_definitions')
      .delete()
      .eq('id', params.report_id as string)
      .eq('project_id', ctx.projectId);
    if (error) throw new Error(`Failed to delete report: ${error.message}`);
    return JSON.stringify({ success: true });
  },
});

defineTool({
  name: 'reports.forecasting',
  description: 'Get pipeline forecasting data with weighted/unweighted projections by quarter',
  minRole: 'viewer',
  parameters: z.object({
    user_id: z.string().uuid().optional().describe('Filter by deal owner'),
  }),
  handler: async (params, ctx) => {
    let query = ctx.supabase
      .from('opportunities')
      .select('id, name, amount, probability, expected_close_date, stage, owner_id')
      .eq('project_id', ctx.projectId)
      .is('deleted_at', null)
      .not('expected_close_date', 'is', null);
    if (params.user_id) query = query.eq('owner_id', params.user_id as string);
    const { data, error } = await query;
    if (error) throw new Error(`Failed to get forecasting data: ${error.message}`);

    const opps = data ?? [];
    const quarters: Record<string, { weighted: number; unweighted: number; count: number }> = {};
    for (const o of opps) {
      const d = new Date(o.expected_close_date as string);
      const q = `${d.getFullYear()}-Q${Math.ceil((d.getMonth() + 1) / 3)}`;
      if (!quarters[q]) quarters[q] = { weighted: 0, unweighted: 0, count: 0 };
      const amt = (o.amount as number) ?? 0;
      const prob = (o.probability as number) ?? 50;
      quarters[q].unweighted += amt;
      quarters[q].weighted += amt * (prob / 100);
      quarters[q].count++;
    }

    return JSON.stringify({ quarters, total_deals: opps.length });
  },
});

// ── Templates Tools ─────────────────────────────────────────────────────────

defineTool({
  name: 'templates.list',
  description: 'List email templates',
  minRole: 'viewer',
  parameters: z.object({
    category: z.string().optional().describe('Filter by category'),
    is_active: z.boolean().optional(),
    search: z.string().optional(),
    limit: z.number().int().min(1).max(100).default(50),
    offset: z.number().int().min(0).default(0),
  }),
  handler: async (params, ctx) => {
    const { category, is_active, search, limit = 50, offset = 0 } = params as any;
    let query = ctx.supabase
      .from('email_templates')
      .select('*', { count: 'exact' })
      .eq('project_id', ctx.projectId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (category) query = query.eq('category', category);
    if (is_active !== undefined) query = query.eq('is_active', is_active);
    if (search) {
      const s = search.replace(/[%_\\]/g, '\\$&');
      query = query.or(`name.ilike."%${s}%",subject.ilike."%${s}%"`);
    }
    const { data, error, count } = await query;
    if (error) throw new Error(`Failed to list templates: ${error.message}`);
    return JSON.stringify({ templates: data, pagination: { limit, offset, total: count ?? 0 } });
  },
});

defineTool({
  name: 'templates.get',
  description: 'Get a single email template by ID',
  minRole: 'viewer',
  parameters: z.object({
    template_id: z.string().uuid().describe('Template ID'),
  }),
  handler: async (params, ctx) => {
    const { data, error } = await ctx.supabase
      .from('email_templates')
      .select('*')
      .eq('id', params.template_id as string)
      .eq('project_id', ctx.projectId)
      .single();
    if (error) throw new Error(`Template not found: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'templates.create',
  description: 'Create a new email template',
  minRole: 'member',
  parameters: z.object({
    name: z.string().min(1).max(255).describe('Template name'),
    description: z.string().max(1000).nullable().optional(),
    subject: z.string().min(1).max(500).describe('Email subject line'),
    body_html: z.string().min(1).describe('HTML body'),
    body_text: z.string().nullable().optional().describe('Plain text body'),
    category: z.string().optional().describe('Template category'),
    is_active: z.boolean().default(true),
    is_shared: z.boolean().default(false),
  }),
  handler: async (params, ctx) => {
    const { data, error } = await ctx.supabase
      .from('email_templates')
      .insert({
        ...params as any,
        project_id: ctx.projectId,
        created_by: ctx.userId,
      } as any)
      .select()
      .single();
    if (error) throw new Error(`Failed to create template: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'templates.update',
  description: 'Update an email template',
  minRole: 'member',
  parameters: z.object({
    template_id: z.string().uuid().describe('Template ID'),
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(1000).nullable().optional(),
    subject: z.string().min(1).max(500).optional(),
    body_html: z.string().min(1).optional(),
    body_text: z.string().nullable().optional(),
    category: z.string().optional(),
    is_active: z.boolean().optional(),
    is_shared: z.boolean().optional(),
  }),
  handler: async (params, ctx) => {
    const { template_id: id, ...updates } = params as Record<string, unknown>;
    const { data, error } = await ctx.supabase
      .from('email_templates')
      .update(updates as any)
      .eq('id', id as string)
      .eq('project_id', ctx.projectId)
      .select()
      .single();
    if (error) throw new Error(`Failed to update template: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'templates.delete',
  description: 'Delete an email template',
  minRole: 'admin',
  parameters: z.object({
    template_id: z.string().uuid().describe('Template ID'),
  }),
  handler: async (params, ctx) => {
    const { error } = await ctx.supabase
      .from('email_templates')
      .delete()
      .eq('id', params.template_id as string)
      .eq('project_id', ctx.projectId);
    if (error) throw new Error(`Failed to delete template: ${error.message}`);
    return JSON.stringify({ success: true });
  },
});

// ── Activity Tools ──────────────────────────────────────────────────────────

defineTool({
  name: 'activity.list',
  description: 'List activity log entries with filters for entity, action, user, and date range',
  minRole: 'viewer',
  parameters: z.object({
    entity_type: z.string().optional().describe('Filter by entity type'),
    entity_id: z.string().uuid().optional().describe('Filter by entity ID'),
    action: z.string().optional().describe('Filter by action type'),
    user_id: z.string().uuid().optional().describe('Filter by user'),
    person_id: z.string().uuid().optional().describe('Filter by person'),
    organization_id: z.string().uuid().optional().describe('Filter by organization'),
    start_date: z.string().optional().describe('Start date (ISO)'),
    end_date: z.string().optional().describe('End date (ISO)'),
    limit: z.number().int().min(1).max(100).default(50),
    offset: z.number().int().min(0).default(0),
  }),
  handler: async (params, ctx) => {
    const { entity_type, entity_id, action, user_id, person_id, organization_id, start_date, end_date, limit = 50, offset = 0 } = params as any;
    let query = ctx.supabase
      .from('activity_log')
      .select('*', { count: 'exact' })
      .eq('project_id', ctx.projectId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (entity_type) query = query.eq('entity_type', entity_type);
    if (entity_id) query = query.eq('entity_id', entity_id);
    if (action) query = query.eq('action', action);
    if (user_id) query = query.eq('user_id', user_id);
    if (person_id) query = query.eq('person_id', person_id);
    if (organization_id) query = query.eq('organization_id', organization_id);
    if (start_date) query = query.gte('created_at', start_date);
    if (end_date) query = query.lte('created_at', end_date);
    const { data, error, count } = await query;
    if (error) throw new Error(`Failed to list activity: ${error.message}`);
    return JSON.stringify({ activities: data, pagination: { limit, offset, total: count ?? 0 } });
  },
});

defineTool({
  name: 'activity.follow_ups',
  description: 'List follow-up tasks grouped by status (overdue, today, upcoming)',
  minRole: 'viewer',
  parameters: z.object({
    status: z.enum(['overdue', 'today', 'upcoming']).optional().describe('Filter by follow-up status'),
    assigned_to: z.string().uuid().optional().describe('Filter by assignee'),
    limit: z.number().int().min(1).max(100).default(50),
    offset: z.number().int().min(0).default(0),
  }),
  handler: async (params, ctx) => {
    const { status, assigned_to, limit = 50, offset = 0 } = params as any;
    const now = new Date().toISOString().split('T')[0] ?? '';
    let query = ctx.supabase
      .from('tasks')
      .select('*', { count: 'exact' })
      .eq('project_id', ctx.projectId)
      .eq('is_follow_up', true)
      .neq('status', 'completed')
      .order('due_date', { ascending: true })
      .range(offset, offset + limit - 1);
    if (assigned_to) query = query.eq('assigned_to', assigned_to);
    if (status === 'overdue') query = query.lt('due_date', now);
    else if (status === 'today') query = query.eq('due_date', now);
    else if (status === 'upcoming') query = query.gt('due_date', now);
    const { data, error, count } = await query;
    if (error) throw new Error(`Failed to list follow-ups: ${error.message}`);
    return JSON.stringify({ activities: data, pagination: { limit, offset, total: count ?? 0 } });
  },
});

// ── Email Inbox Tool ────────────────────────────────────────────────────────

defineTool({
  name: 'email.inbox',
  description: 'List emails from the inbox with filtering by person, organization, direction',
  minRole: 'viewer',
  parameters: z.object({
    person_id: z.string().uuid().optional().describe('Filter by person'),
    organization_id: z.string().uuid().optional().describe('Filter by organization'),
    direction: z.enum(['inbound', 'outbound']).optional().describe('Filter by direction'),
    thread_id: z.string().optional().describe('Filter by thread ID'),
    limit: z.number().int().min(1).max(100).default(50),
    offset: z.number().int().min(0).default(0),
  }),
  handler: async (params, ctx) => {
    const { person_id, organization_id, direction, thread_id, limit = 50, offset = 0 } = params as any;
    let query = ctx.supabase
      .from('emails')
      .select('*', { count: 'exact' })
      .eq('project_id', ctx.projectId)
      .order('date', { ascending: false })
      .range(offset, offset + limit - 1);
    if (person_id) query = query.eq('person_id', person_id);
    if (organization_id) query = query.eq('organization_id', organization_id);
    if (direction) query = query.eq('direction', direction);
    if (thread_id) query = query.eq('thread_id', thread_id);
    const { data, error, count } = await query;
    if (error) throw new Error(`Failed to list emails: ${error.message}`);
    return JSON.stringify({ emails: data, total: count ?? 0 });
  },
});

// ── Research Tools ──────────────────────────────────────────────────────────

defineTool({
  name: 'research.list',
  description: 'List AI research jobs for entities in the project',
  minRole: 'viewer',
  parameters: z.object({
    entity_type: z.string().optional().describe('Filter by entity type'),
    entity_id: z.string().uuid().optional().describe('Filter by entity ID'),
    status: z.string().optional().describe('Filter by status (pending, completed, failed)'),
    limit: z.number().int().min(1).max(100).default(50),
    offset: z.number().int().min(0).default(0),
  }),
  handler: async (params, ctx) => {
    const { entity_type, entity_id, status, limit = 50, offset = 0 } = params as any;
    let query = ctx.supabase
      .from('research_jobs')
      .select('*', { count: 'exact' })
      .eq('project_id', ctx.projectId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (entity_type) query = query.eq('entity_type', entity_type);
    if (entity_id) query = query.eq('entity_id', entity_id);
    if (status) query = query.eq('status', status);
    const { data, error, count } = await query;
    if (error) throw new Error(`Failed to list research jobs: ${error.message}`);
    return JSON.stringify({ jobs: data, pagination: { limit, offset, total: count ?? 0 } });
  },
});

defineTool({
  name: 'research.get',
  description: 'Get a research job by ID with its results',
  minRole: 'viewer',
  parameters: z.object({
    research_job_id: z.string().uuid().describe('Research job ID'),
  }),
  handler: async (params, ctx) => {
    const { data, error } = await ctx.supabase
      .from('research_jobs')
      .select('*')
      .eq('id', params.research_job_id as string)
      .eq('project_id', ctx.projectId)
      .single();
    if (error) throw new Error(`Research job not found: ${error.message}`);
    return JSON.stringify(data);
  },
});

// ── Drafts Tools ────────────────────────────────────────────────────────────

defineTool({
  name: 'drafts.list',
  description: 'List email drafts for the current user',
  minRole: 'member',
  parameters: z.object({
    status: z.string().optional().describe('Filter by status (draft, scheduled, sending, sent)'),
    limit: z.number().int().min(1).max(100).default(50),
    offset: z.number().int().min(0).default(0),
  }),
  handler: async (params, ctx) => {
    const { status, limit = 50, offset = 0 } = params as any;
    let query = ctx.supabase
      .from('email_drafts')
      .select('*', { count: 'exact' })
      .eq('project_id', ctx.projectId)
      .eq('user_id', ctx.userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (status) query = query.eq('status', status);
    const { data, error, count } = await query;
    if (error) throw new Error(`Failed to list drafts: ${error.message}`);
    return JSON.stringify({ drafts: data, pagination: { limit, offset, total: count ?? 0 } });
  },
});

defineTool({
  name: 'drafts.get',
  description: 'Get a single email draft by ID',
  minRole: 'member',
  parameters: z.object({
    draft_id: z.string().uuid().describe('Draft ID'),
  }),
  handler: async (params, ctx) => {
    const { data, error } = await ctx.supabase
      .from('email_drafts')
      .select('*')
      .eq('id', params.draft_id as string)
      .eq('project_id', ctx.projectId)
      .eq('user_id', ctx.userId)
      .single();
    if (error) throw new Error(`Draft not found: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'drafts.create',
  description: 'Create a new email draft',
  minRole: 'member',
  parameters: z.object({
    subject: z.string().min(1).max(500).describe('Email subject'),
    body_html: z.string().min(1).describe('HTML body'),
    body_text: z.string().nullable().optional(),
    to_addresses: z.array(z.string().email()).min(1).describe('Recipient emails'),
    cc_addresses: z.array(z.string().email()).optional(),
    bcc_addresses: z.array(z.string().email()).optional(),
    reply_to: z.string().email().nullable().optional(),
    person_id: z.string().uuid().nullable().optional().describe('Linked person'),
    template_id: z.string().uuid().nullable().optional().describe('Template used'),
    scheduled_at: z.string().nullable().optional().describe('ISO datetime to schedule send'),
  }),
  handler: async (params, ctx) => {
    const { data, error } = await ctx.supabase
      .from('email_drafts')
      .insert({
        ...params as any,
        project_id: ctx.projectId,
        user_id: ctx.userId,
        status: (params as any).scheduled_at ? 'scheduled' : 'draft',
      } as any)
      .select()
      .single();
    if (error) throw new Error(`Failed to create draft: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'drafts.update',
  description: 'Update an email draft (cannot update sent drafts)',
  minRole: 'member',
  parameters: z.object({
    draft_id: z.string().uuid().describe('Draft ID'),
    subject: z.string().min(1).max(500).optional(),
    body_html: z.string().min(1).optional(),
    body_text: z.string().nullable().optional(),
    to_addresses: z.array(z.string().email()).min(1).optional(),
    cc_addresses: z.array(z.string().email()).optional(),
    bcc_addresses: z.array(z.string().email()).optional(),
    reply_to: z.string().email().nullable().optional(),
    scheduled_at: z.string().nullable().optional(),
  }),
  handler: async (params, ctx) => {
    const { draft_id: id, ...updates } = params as Record<string, unknown>;
    const { data, error } = await ctx.supabase
      .from('email_drafts')
      .update(updates as any)
      .eq('id', id as string)
      .eq('project_id', ctx.projectId)
      .eq('user_id', ctx.userId)
      .in('status', ['draft', 'scheduled'])
      .select()
      .single();
    if (error) throw new Error(`Failed to update draft: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'drafts.delete',
  description: 'Delete an email draft',
  minRole: 'member',
  parameters: z.object({
    draft_id: z.string().uuid().describe('Draft ID'),
  }),
  handler: async (params, ctx) => {
    const { error } = await ctx.supabase
      .from('email_drafts')
      .delete()
      .eq('id', params.draft_id as string)
      .eq('project_id', ctx.projectId)
      .eq('user_id', ctx.userId);
    if (error) throw new Error(`Failed to delete draft: ${error.message}`);
    return JSON.stringify({ success: true });
  },
});

// ── RFP Questions Tools ─────────────────────────────────────────────────────

defineTool({
  name: 'rfp_questions.list',
  description: 'List questions for an RFP with counts by status and sections',
  minRole: 'viewer',
  parameters: z.object({
    rfp_id: z.string().uuid().describe('RFP ID'),
    status: z.string().optional().describe('Filter by status (unanswered, draft, review, approved)'),
    section: z.string().optional().describe('Filter by section name'),
  }),
  handler: async (params, ctx) => {
    const { rfp_id, status, section } = params as any;
    let query = ctx.supabase
      .from('rfp_questions')
      .select('*', { count: 'exact' })
      .eq('rfp_id', rfp_id)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true });
    if (status) query = query.eq('status', status);
    if (section) query = query.eq('section_name', section);
    const { data, error, count } = await query;
    if (error) throw new Error(`Failed to list RFP questions: ${error.message}`);
    return JSON.stringify({ questions: data, total: count ?? 0 });
  },
});

defineTool({
  name: 'rfp_questions.get',
  description: 'Get a single RFP question by ID',
  minRole: 'viewer',
  parameters: z.object({
    rfp_id: z.string().uuid().describe('RFP ID'),
    question_id: z.string().uuid().describe('Question ID'),
  }),
  handler: async (params, ctx) => {
    const { data, error } = await ctx.supabase
      .from('rfp_questions')
      .select('*')
      .eq('id', params.question_id as string)
      .eq('rfp_id', params.rfp_id as string)
      .is('deleted_at', null)
      .single();
    if (error) throw new Error(`RFP question not found: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'rfp_questions.create',
  description: 'Add a question to an RFP',
  minRole: 'member',
  parameters: z.object({
    rfp_id: z.string().uuid().describe('RFP ID'),
    question_text: z.string().min(1).describe('Question text'),
    answer_text: z.string().optional().describe('Answer text'),
    answer_html: z.string().optional().describe('HTML answer'),
    status: z.string().default('unanswered').describe('Status (unanswered, draft, review, approved)'),
    priority: z.string().optional().describe('Priority level'),
    section_name: z.string().optional().describe('Section name'),
    notes: z.string().optional().describe('Notes'),
  }),
  handler: async (params, ctx) => {
    const { rfp_id, ...fields } = params as any;
    const { data, error } = await ctx.supabase
      .from('rfp_questions')
      .insert({
        ...fields,
        rfp_id,
        created_by: ctx.userId,
      } as any)
      .select()
      .single();
    if (error) throw new Error(`Failed to create RFP question: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'rfp_questions.update',
  description: 'Update an RFP question (text, answer, status, assignment)',
  minRole: 'member',
  parameters: z.object({
    rfp_id: z.string().uuid().describe('RFP ID'),
    question_id: z.string().uuid().describe('Question ID'),
    question_text: z.string().optional(),
    answer_text: z.string().optional(),
    answer_html: z.string().optional(),
    status: z.string().optional(),
    priority: z.string().optional(),
    assigned_to: z.string().uuid().optional(),
    section_name: z.string().optional(),
    notes: z.string().optional(),
  }),
  handler: async (params, ctx) => {
    const { rfp_id, question_id, ...updates } = params as any;
    const { data, error } = await ctx.supabase
      .from('rfp_questions')
      .update(updates as any)
      .eq('id', question_id)
      .eq('rfp_id', rfp_id)
      .select()
      .single();
    if (error) throw new Error(`Failed to update RFP question: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'rfp_questions.delete',
  description: 'Delete an RFP question (soft delete)',
  minRole: 'member',
  parameters: z.object({
    rfp_id: z.string().uuid().describe('RFP ID'),
    question_id: z.string().uuid().describe('Question ID'),
  }),
  handler: async (params, ctx) => {
    const { error } = await ctx.supabase
      .from('rfp_questions')
      .update({ deleted_at: new Date().toISOString() } as any)
      .eq('id', params.question_id as string)
      .eq('rfp_id', params.rfp_id as string);
    if (error) throw new Error(`Failed to delete RFP question: ${error.message}`);
    return JSON.stringify({ success: true });
  },
});

// ── Widget Tools ────────────────────────────────────────────────────────────

defineTool({
  name: 'widgets.list',
  description: 'List dashboard widgets for the current user',
  minRole: 'viewer',
  parameters: z.object({
    widget_type: z.string().optional().describe('Filter by widget type'),
    is_visible: z.boolean().optional(),
  }),
  handler: async (params, ctx) => {
    const { widget_type, is_visible } = params as any;
    let query = ctx.supabase
      .from('dashboard_widgets')
      .select('*')
      .eq('project_id', ctx.projectId)
      .eq('user_id', ctx.userId)
      .order('position', { ascending: true });
    if (widget_type) query = query.eq('widget_type', widget_type);
    if (is_visible !== undefined) query = query.eq('is_visible', is_visible);
    const { data, error } = await query;
    if (error) throw new Error(`Failed to list widgets: ${error.message}`);
    return JSON.stringify({ widgets: data });
  },
});

defineTool({
  name: 'widgets.create',
  description: 'Create a new dashboard widget',
  minRole: 'member',
  parameters: z.object({
    widget_type: z.string().describe('Widget type'),
    config: z.record(z.string(), z.unknown()).default({}).describe('Widget configuration'),
    position: z.number().int().min(0).optional().describe('Position order'),
    size: z.string().optional().describe('Widget size (small, medium, large)'),
    is_visible: z.boolean().default(true),
  }),
  handler: async (params, ctx) => {
    const { data, error } = await ctx.supabase
      .from('dashboard_widgets')
      .insert({
        ...params as any,
        project_id: ctx.projectId,
        user_id: ctx.userId,
      } as any)
      .select()
      .single();
    if (error) throw new Error(`Failed to create widget: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'widgets.update',
  description: 'Update a dashboard widget',
  minRole: 'member',
  parameters: z.object({
    widget_id: z.string().uuid().describe('Widget ID'),
    config: z.record(z.string(), z.unknown()).optional(),
    position: z.number().int().min(0).optional(),
    size: z.string().optional(),
    is_visible: z.boolean().optional(),
  }),
  handler: async (params, ctx) => {
    const { widget_id: id, ...updates } = params as Record<string, unknown>;
    const { data, error } = await ctx.supabase
      .from('dashboard_widgets')
      .update(updates as any)
      .eq('id', id as string)
      .eq('project_id', ctx.projectId)
      .eq('user_id', ctx.userId)
      .select()
      .single();
    if (error) throw new Error(`Failed to update widget: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'widgets.delete',
  description: 'Delete a dashboard widget',
  minRole: 'member',
  parameters: z.object({
    widget_id: z.string().uuid().describe('Widget ID'),
  }),
  handler: async (params, ctx) => {
    const { error } = await ctx.supabase
      .from('dashboard_widgets')
      .delete()
      .eq('id', params.widget_id as string)
      .eq('project_id', ctx.projectId)
      .eq('user_id', ctx.userId);
    if (error) throw new Error(`Failed to delete widget: ${error.message}`);
    return JSON.stringify({ success: true });
  },
});

// ── Members & Invitations Tools ─────────────────────────────────────────────

defineTool({
  name: 'members.list',
  description: 'List project members with their roles',
  minRole: 'viewer',
  parameters: z.object({}),
  handler: async (_params, ctx) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (ctx.supabase as any)
      .from('project_memberships')
      .select('user_id, role, created_at, users:user_id(id, full_name, email, avatar_url)')
      .eq('project_id', ctx.projectId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(`Failed to list members: ${error.message}`);
    return JSON.stringify({ members: data });
  },
});

defineTool({
  name: 'members.update_role',
  description: 'Update a project member role',
  minRole: 'admin',
  parameters: z.object({
    user_id: z.string().uuid().describe('User ID of the member'),
    role: z.enum(['viewer', 'member', 'admin']).describe('New role'),
  }),
  handler: async (params, ctx) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (ctx.supabase as any)
      .from('project_memberships')
      .update({ role: params.role as string })
      .eq('project_id', ctx.projectId)
      .eq('user_id', params.user_id as string)
      .select()
      .single();
    if (error) throw new Error(`Failed to update member role: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'invitations.list',
  description: 'List pending project invitations',
  minRole: 'admin',
  parameters: z.object({
    status: z.enum(['pending', 'accepted', 'expired']).optional(),
  }),
  handler: async (params, ctx) => {
    let query = ctx.supabase
      .from('project_invitations')
      .select('*')
      .eq('project_id', ctx.projectId)
      .order('created_at', { ascending: false });
    if (params.status) query = query.eq('status', params.status as string);
    const { data, error } = await query;
    if (error) throw new Error(`Failed to list invitations: ${error.message}`);
    return JSON.stringify({ invitations: data });
  },
});

// ── Project Settings Tools ──────────────────────────────────────────────────

defineTool({
  name: 'settings.get',
  description: 'Get project settings',
  minRole: 'viewer',
  parameters: z.object({}),
  handler: async (_params, ctx) => {
    const { data, error } = await ctx.supabase
      .from('projects')
      .select('id, name, slug, settings, created_at, updated_at')
      .eq('id', ctx.projectId)
      .single();
    if (error) throw new Error(`Failed to get settings: ${error.message}`);
    return JSON.stringify(data);
  },
});

// ── Duplicates & Merge Tools ────────────────────────────────────────────────

defineTool({
  name: 'duplicates.list',
  description: 'List duplicate candidate pairs detected in the project',
  minRole: 'viewer',
  parameters: z.object({
    entity_type: z.enum(['person', 'organization']).optional().describe('Filter by entity type'),
    status: z.enum(['pending', 'allowed', 'merged']).default('pending').describe('Filter by status'),
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(50),
  }),
  handler: async (params, ctx) => {
    const { entity_type, status = 'pending', page = 1, limit = 50 } = params as any;
    const offset = (page - 1) * limit;
    let query = ctx.supabase
      .from('duplicate_candidates')
      .select('*', { count: 'exact' })
      .eq('project_id', ctx.projectId)
      .eq('status', status)
      .order('confidence_score', { ascending: false })
      .range(offset, offset + limit - 1);
    if (entity_type) query = query.eq('entity_type', entity_type);
    const { data, error, count } = await query;
    if (error) throw new Error(`Failed to list duplicates: ${error.message}`);
    return JSON.stringify({ candidates: data, pagination: { page, limit, total: count ?? 0 } });
  },
});

defineTool({
  name: 'duplicates.resolve',
  description: 'Resolve a duplicate pair by allowing it or merging the records',
  minRole: 'member',
  parameters: z.object({
    duplicate_id: z.string().uuid().describe('Duplicate candidate ID'),
    action: z.enum(['allow', 'merge']).describe('Allow (keep both) or merge'),
    survivor_id: z.string().uuid().optional().describe('ID of the record to keep (for merge)'),
    field_selections: z.record(z.string(), z.string()).optional().describe('Field-level merge selections'),
  }),
  handler: async (params, ctx) => {
    const { duplicate_id: id, action, survivor_id, field_selections } = params as any;
    if (action === 'allow') {
      const { error } = await ctx.supabase
        .from('duplicate_candidates')
        .update({ status: 'allowed', resolved_by: ctx.userId, resolved_at: new Date().toISOString() } as any)
        .eq('id', id)
        .eq('project_id', ctx.projectId);
      if (error) throw new Error(`Failed to resolve duplicate: ${error.message}`);
      return JSON.stringify({ success: true, status: 'allowed' });
    }
    // For merge, call the merge RPC or direct logic
    const { data: candidate, error: fetchErr } = await ctx.supabase
      .from('duplicate_candidates')
      .select('*')
      .eq('id', id)
      .eq('project_id', ctx.projectId)
      .single();
    if (fetchErr) throw new Error(`Duplicate not found: ${fetchErr.message}`);
    const survivorId = survivor_id || (candidate as any).entity_id_a;
    const mergeId = survivorId === (candidate as any).entity_id_a ? (candidate as any).entity_id_b : (candidate as any).entity_id_a;
    const entityType = (candidate as any).entity_type;
    // Soft-delete the merged record
    const table = entityType === 'person' ? 'people' : 'organizations';
    const { error: mergeErr } = await ctx.supabase
      .from(table)
      .update({ deleted_at: new Date().toISOString() } as any)
      .eq('id', mergeId);
    if (mergeErr) throw new Error(`Failed to merge: ${mergeErr.message}`);
    // Mark candidate as merged
    await ctx.supabase
      .from('duplicate_candidates')
      .update({ status: 'merged', resolved_by: ctx.userId, resolved_at: new Date().toISOString(), survivor_id: survivorId } as any)
      .eq('id', id);
    emitAutomationEvent({
      projectId: ctx.projectId,
      triggerType: 'entity.merged' as any,
      entityType: entityType as any,
      entityId: survivorId,
      data: { survivor_id: survivorId, merged_id: mergeId, field_selections },
    });
    return JSON.stringify({ success: true, status: 'merged', survivor_id: survivorId });
  },
});

defineTool({
  name: 'merge.execute',
  description: 'Directly merge records without a duplicate candidate (merge multiple into one survivor)',
  minRole: 'member',
  parameters: z.object({
    entity_type: z.enum(['person', 'organization']).describe('Entity type'),
    survivor_id: z.string().uuid().describe('ID of the record to keep'),
    merge_ids: z.array(z.string().uuid()).min(1).describe('IDs of records to merge into survivor'),
  }),
  handler: async (params, ctx) => {
    const { entity_type, survivor_id, merge_ids } = params as any;
    const table = entity_type === 'person' ? 'people' : 'organizations';
    const { error } = await ctx.supabase
      .from(table)
      .update({ deleted_at: new Date().toISOString() } as any)
      .in('id', merge_ids)
      .eq('project_id', ctx.projectId);
    if (error) throw new Error(`Failed to merge: ${error.message}`);
    emitAutomationEvent({
      projectId: ctx.projectId,
      triggerType: 'entity.merged' as any,
      entityType: entity_type as any,
      entityId: survivor_id,
      data: { survivor_id, merged_ids: merge_ids },
    });
    return JSON.stringify({ success: true, survivor_id, merged_count: merge_ids.length });
  },
});

// ── Enrichment Tools ────────────────────────────────────────────────────────

defineTool({
  name: 'enrichment.list',
  description: 'List enrichment jobs and their results',
  minRole: 'viewer',
  parameters: z.object({
    person_id: z.string().uuid().optional().describe('Filter by person'),
    status: z.string().optional().describe('Filter by status (pending, processing, completed, failed)'),
    limit: z.number().int().min(1).max(100).default(50),
    offset: z.number().int().min(0).default(0),
  }),
  handler: async (params, ctx) => {
    const { person_id, status, limit = 50, offset = 0 } = params as any;
    let query = ctx.supabase
      .from('enrichment_jobs')
      .select('*', { count: 'exact' })
      .eq('project_id', ctx.projectId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (person_id) query = query.eq('person_id', person_id);
    if (status) query = query.eq('status', status);
    const { data, error, count } = await query;
    if (error) throw new Error(`Failed to list enrichment jobs: ${error.message}`);
    return JSON.stringify({ jobs: data, pagination: { limit, offset, total: count ?? 0 } });
  },
});

defineTool({
  name: 'enrichment.start',
  description: 'Start an enrichment job for a person (uses FullEnrich to find emails, phone numbers, social profiles)',
  minRole: 'member',
  parameters: z.object({
    person_id: z.string().uuid().describe('Person ID to enrich'),
  }),
  handler: async (params, ctx) => {
    // Get person details
    const { data: person, error: personErr } = await ctx.supabase
      .from('people')
      .select('id, first_name, last_name, email')
      .eq('id', params.person_id as string)
      .eq('project_id', ctx.projectId)
      .is('deleted_at', null)
      .single();
    if (personErr) throw new Error(`Person not found: ${personErr.message}`);

    // Get org for company context
    const { data: orgLink } = await ctx.supabase
      .from('person_organizations')
      .select('organization:organization_id(name, domain)')
      .eq('person_id', params.person_id as string)
      .limit(1)
      .maybeSingle();

    // Create enrichment job
    const { data: job, error: jobErr } = await ctx.supabase
      .from('enrichment_jobs')
      .insert({
        project_id: ctx.projectId,
        person_id: params.person_id,
        status: 'pending',
        input_data: {
          first_name: person.first_name,
          last_name: person.last_name,
          email: person.email,
          company: (orgLink as any)?.organization?.name ?? null,
          domain: (orgLink as any)?.organization?.domain ?? null,
        },
        created_by: ctx.userId,
      } as any)
      .select()
      .single();
    if (jobErr) throw new Error(`Failed to start enrichment: ${jobErr.message}`);
    return JSON.stringify({ job, message: 'Enrichment job started. Results will be available when processing completes.' });
  },
});

// ── Contact Discovery Tools ────────────────────────────────────────────────

defineTool({
  name: 'contacts.discover',
  description: 'Discover contacts at an organization using AI-powered search. Returns suggested contacts with names, titles, and emails.',
  minRole: 'member',
  parameters: z.object({
    organization_id: z.string().uuid().describe('Organization ID'),
    roles: z.array(z.string()).min(1).describe('Job titles/roles to search for (e.g. ["CEO", "CTO", "VP Sales"])'),
    max_results: z.number().int().min(1).max(20).default(5),
  }),
  handler: async (params, ctx) => {
    const { organization_id, roles, max_results = 5 } = params as any;
    const { data: org, error: orgErr } = await ctx.supabase
      .from('organizations')
      .select('id, name, domain')
      .eq('id', organization_id)
      .eq('project_id', ctx.projectId)
      .is('deleted_at', null)
      .single();
    if (orgErr) throw new Error(`Organization not found: ${orgErr.message}`);
    return JSON.stringify({
      message: `Contact discovery for ${org.name} requires the discover-contacts API endpoint. Use the CRM UI for AI-powered contact discovery, or manually create contacts with the people.create tool.`,
      organization: org,
      roles_requested: roles,
      max_results,
    });
  },
});

defineTool({
  name: 'contacts.add_to_org',
  description: 'Add contacts (people) to an organization, automatically linking them',
  minRole: 'member',
  parameters: z.object({
    organization_id: z.string().uuid().describe('Organization ID'),
    contacts: z.array(z.object({
      first_name: z.string().min(1),
      last_name: z.string().min(1),
      email: z.string().email().optional(),
      job_title: z.string().optional(),
      linkedin_url: z.string().optional(),
    })).min(1).describe('Contacts to add'),
  }),
  handler: async (params, ctx) => {
    const { organization_id, contacts } = params as any;
    // Verify org exists
    const { error: orgErr } = await ctx.supabase
      .from('organizations')
      .select('id')
      .eq('id', organization_id)
      .eq('project_id', ctx.projectId)
      .is('deleted_at', null)
      .single();
    if (orgErr) throw new Error(`Organization not found: ${orgErr.message}`);

    const created: any[] = [];
    const errors: any[] = [];
    for (const contact of contacts) {
      const { data: person, error: personErr } = await ctx.supabase
        .from('people')
        .insert({
          first_name: contact.first_name,
          last_name: contact.last_name,
          email: contact.email || null,
          job_title: contact.job_title || null,
          linkedin_url: contact.linkedin_url || null,
          project_id: ctx.projectId,
          created_by: ctx.userId,
        } as any)
        .select()
        .single();
      if (personErr) {
        errors.push({ contact, error: personErr.message });
        continue;
      }
      // Link to org
      await ctx.supabase
        .from('person_organizations')
        .insert({
          person_id: person.id,
          organization_id,
          job_title: contact.job_title || null,
        } as any);
      created.push({ id: person.id, first_name: contact.first_name, last_name: contact.last_name });
    }
    return JSON.stringify({ created, created_count: created.length, errors });
  },
});

// ── SMS Tools ───────────────────────────────────────────────────────────────

defineTool({
  name: 'sms.list',
  description: 'List SMS messages, optionally filtered by person or organization',
  minRole: 'viewer',
  parameters: z.object({
    person_id: z.string().uuid().optional().describe('Filter by person'),
    organization_id: z.string().uuid().optional().describe('Filter by organization'),
    limit: z.number().int().min(1).max(200).default(100),
  }),
  handler: async (params, ctx) => {
    const { person_id, organization_id, limit = 100 } = params as any;
    let query = ctx.supabase
      .from('sms_messages')
      .select('*')
      .eq('project_id', ctx.projectId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (person_id) query = query.eq('person_id', person_id);
    if (organization_id) query = query.eq('organization_id', organization_id);
    const { data, error } = await query;
    if (error) throw new Error(`Failed to list SMS messages: ${error.message}`);
    return JSON.stringify({ messages: data });
  },
});

defineTool({
  name: 'sms.send',
  description: 'Send an SMS message to a phone number',
  minRole: 'member',
  parameters: z.object({
    to_number: z.string().min(1).describe('Phone number to send to (E.164 format)'),
    body: z.string().min(1).max(1600).describe('SMS message body'),
    person_id: z.string().uuid().optional().describe('Link to person'),
    organization_id: z.string().uuid().optional().describe('Link to organization'),
  }),
  handler: async (params, ctx) => {
    // Create the SMS record
    const { data, error } = await ctx.supabase
      .from('sms_messages')
      .insert({
        project_id: ctx.projectId,
        user_id: ctx.userId,
        to_number: params.to_number,
        body: params.body,
        direction: 'outbound',
        status: 'queued',
        person_id: (params as any).person_id || null,
        organization_id: (params as any).organization_id || null,
      } as any)
      .select()
      .single();
    if (error) throw new Error(`Failed to send SMS: ${error.message}`);
    return JSON.stringify(data);
  },
});

// ── Email Signatures Tools ──────────────────────────────────────────────────

defineTool({
  name: 'signatures.list',
  description: 'List email signatures for the current user',
  minRole: 'viewer',
  parameters: z.object({}),
  handler: async (_params, ctx) => {
    const { data, error } = await ctx.supabase
      .from('email_signatures')
      .select('*')
      .eq('project_id', ctx.projectId)
      .eq('user_id', ctx.userId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Failed to list signatures: ${error.message}`);
    return JSON.stringify({ signatures: data });
  },
});

defineTool({
  name: 'signatures.get',
  description: 'Get a single email signature by ID',
  minRole: 'viewer',
  parameters: z.object({
    signature_id: z.string().uuid().describe('Signature ID'),
  }),
  handler: async (params, ctx) => {
    const { data, error } = await ctx.supabase
      .from('email_signatures')
      .select('*')
      .eq('id', params.signature_id as string)
      .eq('project_id', ctx.projectId)
      .eq('user_id', ctx.userId)
      .single();
    if (error) throw new Error(`Signature not found: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'signatures.create',
  description: 'Create a new email signature',
  minRole: 'member',
  parameters: z.object({
    name: z.string().min(1).max(100).describe('Signature name'),
    sender_name: z.string().max(100).nullable().optional().describe('Sender display name'),
    content_html: z.string().min(1).max(50000).describe('HTML signature content'),
    is_default: z.boolean().default(false).describe('Set as default signature'),
  }),
  handler: async (params, ctx) => {
    // If setting as default, unset existing defaults
    if ((params as any).is_default) {
      await ctx.supabase
        .from('email_signatures')
        .update({ is_default: false } as any)
        .eq('project_id', ctx.projectId)
        .eq('user_id', ctx.userId);
    }
    const { data, error } = await ctx.supabase
      .from('email_signatures')
      .insert({
        ...params as any,
        project_id: ctx.projectId,
        user_id: ctx.userId,
      } as any)
      .select()
      .single();
    if (error) throw new Error(`Failed to create signature: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'signatures.update',
  description: 'Update an email signature',
  minRole: 'member',
  parameters: z.object({
    signature_id: z.string().uuid().describe('Signature ID'),
    name: z.string().min(1).max(100).optional(),
    sender_name: z.string().max(100).nullable().optional(),
    content_html: z.string().min(1).max(50000).optional(),
    is_default: z.boolean().optional(),
  }),
  handler: async (params, ctx) => {
    const { signature_id: id, ...updates } = params as Record<string, unknown>;
    if ((updates as any).is_default) {
      await ctx.supabase
        .from('email_signatures')
        .update({ is_default: false } as any)
        .eq('project_id', ctx.projectId)
        .eq('user_id', ctx.userId);
    }
    const { data, error } = await ctx.supabase
      .from('email_signatures')
      .update(updates as any)
      .eq('id', id as string)
      .eq('project_id', ctx.projectId)
      .eq('user_id', ctx.userId)
      .select()
      .single();
    if (error) throw new Error(`Failed to update signature: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'signatures.delete',
  description: 'Delete an email signature',
  minRole: 'member',
  parameters: z.object({
    signature_id: z.string().uuid().describe('Signature ID'),
  }),
  handler: async (params, ctx) => {
    const { error } = await ctx.supabase
      .from('email_signatures')
      .delete()
      .eq('id', params.signature_id as string)
      .eq('project_id', ctx.projectId)
      .eq('user_id', ctx.userId);
    if (error) throw new Error(`Failed to delete signature: ${error.message}`);
    return JSON.stringify({ success: true });
  },
});

// ── LinkedIn Message Generation Tool ────────────────────────────────────────

defineTool({
  name: 'linkedin.generate_message',
  description: 'Generate a personalized LinkedIn connection request message using AI',
  minRole: 'member',
  parameters: z.object({
    first_name: z.string().min(1).describe('Recipient first name'),
    last_name: z.string().min(1).describe('Recipient last name'),
    job_title: z.string().nullable().optional().describe('Their job title'),
    company: z.string().nullable().optional().describe('Their company'),
    context: z.string().nullable().optional().describe('Additional context (e.g. "met at conference", "mutual connection via X")'),
  }),
  handler: async (params, _ctx) => {
    // Use OpenRouter to generate the message
    const { getProjectOpenRouterClient } = await import('@/lib/openrouter/client');
    const client = await getProjectOpenRouterClient(_ctx.projectId);
    const prompt = `Generate a short, personalized LinkedIn connection request message (max 300 characters) for:
Name: ${params.first_name} ${params.last_name}
${(params as any).job_title ? `Title: ${(params as any).job_title}` : ''}
${(params as any).company ? `Company: ${(params as any).company}` : ''}
${(params as any).context ? `Context: ${(params as any).context}` : ''}

Keep it brief, professional, and genuine. Do NOT use generic templates. Output ONLY the message text, nothing else.`;

    const result = await client.chat(
      [{ role: 'user', content: prompt }],
      { maxTokens: 500 }
    );
    const message = result.choices?.[0]?.message?.content ?? 'Unable to generate message';
    return JSON.stringify({ message: message.trim() });
  },
});

// ── Bulk Operations Tool ────────────────────────────────────────────────────

defineTool({
  name: 'bulk.execute',
  description: 'Execute bulk operations (update or delete) on multiple records at once',
  minRole: 'member',
  parameters: z.object({
    entity_type: z.enum(['person', 'organization', 'opportunity', 'task', 'rfp']).describe('Entity type'),
    entity_ids: z.array(z.string().uuid()).min(1).max(500).describe('IDs of records to operate on'),
    operation: z.enum(['update', 'delete']).describe('Operation to perform'),
    data: z.record(z.string(), z.unknown()).optional().describe('Fields to update (for update operation)'),
  }),
  handler: async (params, ctx) => {
    const { entity_type, entity_ids, operation, data } = params as any;
    const tableMap: Record<string, string> = {
      person: 'people', organization: 'organizations', opportunity: 'opportunities',
      task: 'tasks', rfp: 'rfps',
    };
    const table = tableMap[entity_type];
    if (!table) throw new Error(`Invalid entity type: ${entity_type}`);

    if (operation === 'delete') {
      const { error } = await ctx.supabase
        .from(table as any)
        .update({ deleted_at: new Date().toISOString() } as any)
        .in('id', entity_ids)
        .eq('project_id', ctx.projectId);
      if (error) throw new Error(`Bulk delete failed: ${error.message}`);
      return JSON.stringify({ success: true, affected_count: entity_ids.length, operation: 'delete' });
    }

    if (operation === 'update' && data) {
      const { error } = await ctx.supabase
        .from(table as any)
        .update(data as any)
        .in('id', entity_ids)
        .eq('project_id', ctx.projectId);
      if (error) throw new Error(`Bulk update failed: ${error.message}`);
      return JSON.stringify({ success: true, affected_count: entity_ids.length, operation: 'update' });
    }

    throw new Error('Update operation requires data parameter');
  },
});

// ── Sequence Steps Tools ────────────────────────────────────────────────────

defineTool({
  name: 'sequence_steps.list',
  description: 'List all steps in a sequence',
  minRole: 'viewer',
  parameters: z.object({
    sequence_id: z.string().uuid().describe('Sequence ID'),
  }),
  handler: async (params, ctx) => {
    // Verify sequence belongs to project
    const { error: seqErr } = await ctx.supabase
      .from('sequences')
      .select('id')
      .eq('id', params.sequence_id as string)
      .eq('project_id', ctx.projectId)
      .single();
    if (seqErr) throw new Error(`Sequence not found: ${seqErr.message}`);

    const { data, error } = await ctx.supabase
      .from('sequence_steps')
      .select('*')
      .eq('sequence_id', params.sequence_id as string)
      .order('step_number', { ascending: true });
    if (error) throw new Error(`Failed to list steps: ${error.message}`);
    return JSON.stringify({ steps: data });
  },
});

defineTool({
  name: 'sequence_steps.get',
  description: 'Get a single sequence step',
  minRole: 'viewer',
  parameters: z.object({
    sequence_id: z.string().uuid().describe('Sequence ID'),
    step_id: z.string().uuid().describe('Step ID'),
  }),
  handler: async (params, ctx) => {
    const { data, error } = await ctx.supabase
      .from('sequence_steps')
      .select('*')
      .eq('id', params.step_id as string)
      .eq('sequence_id', params.sequence_id as string)
      .single();
    if (error) throw new Error(`Step not found: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'sequence_steps.create',
  description: 'Add a step to a sequence (email, delay, SMS, call, task, LinkedIn). Cannot add to active sequences.',
  minRole: 'member',
  parameters: z.object({
    sequence_id: z.string().uuid().describe('Sequence ID'),
    step_type: z.enum(['email', 'delay', 'sms', 'call', 'task', 'linkedin']).describe('Step type'),
    step_number: z.number().int().min(1).optional().describe('Step position'),
    subject: z.string().max(998).nullable().optional().describe('Email subject'),
    body_html: z.string().nullable().optional().describe('Email HTML body'),
    body_text: z.string().nullable().optional().describe('Email plain text'),
    sms_body: z.string().max(1600).nullable().optional().describe('SMS body'),
    delay_amount: z.number().int().min(1).nullable().optional().describe('Delay amount'),
    delay_unit: z.enum(['minutes', 'hours', 'days', 'weeks']).nullable().optional().describe('Delay unit'),
    config: z.record(z.string(), z.unknown()).nullable().optional().describe('Step config (for call/task/linkedin types)'),
  }),
  handler: async (params, ctx) => {
    const { sequence_id, ...stepData } = params as any;
    // Verify sequence is not active
    const { data: seq, error: seqErr } = await ctx.supabase
      .from('sequences')
      .select('id, status')
      .eq('id', sequence_id)
      .eq('project_id', ctx.projectId)
      .single();
    if (seqErr) throw new Error(`Sequence not found: ${seqErr.message}`);
    if (seq.status === 'active') throw new Error('Cannot add steps to an active sequence. Pause it first.');

    const { data, error } = await ctx.supabase
      .from('sequence_steps')
      .insert({ ...stepData, sequence_id } as any)
      .select()
      .single();
    if (error) throw new Error(`Failed to create step: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'sequence_steps.update',
  description: 'Update a sequence step',
  minRole: 'member',
  parameters: z.object({
    sequence_id: z.string().uuid().describe('Sequence ID'),
    step_id: z.string().uuid().describe('Step ID'),
    subject: z.string().max(998).nullable().optional(),
    body_html: z.string().nullable().optional(),
    body_text: z.string().nullable().optional(),
    sms_body: z.string().max(1600).nullable().optional(),
    delay_amount: z.number().int().min(1).nullable().optional(),
    delay_unit: z.enum(['minutes', 'hours', 'days', 'weeks']).nullable().optional(),
    config: z.record(z.string(), z.unknown()).nullable().optional(),
  }),
  handler: async (params, ctx) => {
    const { sequence_id, step_id, ...updates } = params as any;
    // Verify sequence belongs to project
    const { error: seqErr } = await ctx.supabase
      .from('sequences')
      .select('id')
      .eq('id', sequence_id)
      .eq('project_id', ctx.projectId)
      .single();
    if (seqErr) throw new Error(`Sequence not found: ${seqErr.message}`);

    const { data, error } = await ctx.supabase
      .from('sequence_steps')
      .update(updates as any)
      .eq('id', step_id)
      .eq('sequence_id', sequence_id)
      .select()
      .single();
    if (error) throw new Error(`Failed to update step: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'sequence_steps.delete',
  description: 'Delete a sequence step',
  minRole: 'member',
  parameters: z.object({
    sequence_id: z.string().uuid().describe('Sequence ID'),
    step_id: z.string().uuid().describe('Step ID'),
  }),
  handler: async (params, ctx) => {
    const { error: seqErr } = await ctx.supabase
      .from('sequences')
      .select('id, status')
      .eq('id', params.sequence_id as string)
      .eq('project_id', ctx.projectId)
      .single();
    if (seqErr) throw new Error(`Sequence not found: ${seqErr.message}`);

    const { error } = await ctx.supabase
      .from('sequence_steps')
      .delete()
      .eq('id', params.step_id as string)
      .eq('sequence_id', params.sequence_id as string);
    if (error) throw new Error(`Failed to delete step: ${error.message}`);
    return JSON.stringify({ success: true });
  },
});

// ── Reports Run & Analytics Tools ───────────────────────────────────────────

defineTool({
  name: 'reports.run',
  description: 'Execute a saved report and get its results. For custom reports, this executes the report config and returns actual data rows.',
  minRole: 'viewer',
  parameters: z.object({
    report_id: z.string().uuid().describe('Report ID'),
  }),
  handler: async (params, ctx) => {
    const { data: report, error: reportErr } = await ctx.supabase
      .from('report_definitions')
      .select('*')
      .eq('id', params.report_id as string)
      .eq('project_id', ctx.projectId)
      .single();
    if (reportErr) throw new Error(`Report not found: ${reportErr.message}`);

    // Custom reports: execute via query engine and return data
    if (report.report_type === 'custom' && report.config) {
      const { executeCustomReport, ReportQueryError } = await import('@/lib/reports/query-engine');
      try {
        const result = await executeCustomReport(
          ctx.supabase,
          report.config as unknown as import('@/lib/reports/types').CustomReportConfig,
          ctx.projectId
        );
        return JSON.stringify({
          reportName: report.name,
          totalRows: result.totalRows,
          truncated: result.truncated,
          executionMs: result.executionMs,
          columns: result.columns,
          rows: result.rows.slice(0, 50),
          ...(result.rows.length > 50 ? { note: `Showing 50 of ${result.totalRows} total rows` } : {}),
        }, null, 2);
      } catch (e) {
        const message = e instanceof ReportQueryError ? e.message : 'Report execution failed';
        return JSON.stringify({ error: message });
      }
    }

    // Non-custom reports: create a run record
    const startTime = Date.now();
    const { data: run, error: runErr } = await ctx.supabase
      .from('report_runs')
      .insert({
        report_id: params.report_id,
        project_id: ctx.projectId,
        started_by: ctx.userId,
        status: 'completed',
        duration_ms: Date.now() - startTime,
      } as any)
      .select()
      .single();
    if (runErr) throw new Error(`Failed to create report run: ${runErr.message}`);
    return JSON.stringify({ run_id: run.id, status: 'completed', report: report });
  },
});

defineTool({
  name: 'reports.activity_conversions',
  description: 'Get activity-to-conversion metrics (how activities lead to deal progression)',
  minRole: 'viewer',
  parameters: z.object({
    start_date: z.string().optional().describe('Start date (ISO format)'),
    end_date: z.string().optional().describe('End date (ISO format)'),
    user_id: z.string().uuid().optional().describe('Filter by user'),
  }),
  handler: async (params, ctx) => {
    const { start_date, end_date, user_id } = params as any;
    const startDt = start_date || new Date(Date.now() - 30 * 86400000).toISOString();
    const endDt = end_date || new Date().toISOString();

    // Get activity counts
    let actQuery = ctx.supabase
      .from('activity_log')
      .select('action', { count: 'exact' })
      .eq('project_id', ctx.projectId)
      .gte('created_at', startDt)
      .lte('created_at', endDt);
    if (user_id) actQuery = actQuery.eq('user_id', user_id);
    const { data: activities, error } = await actQuery;
    if (error) throw new Error(`Failed to get activity metrics: ${error.message}`);

    // Get opportunity progression in same period
    let oppQuery = ctx.supabase
      .from('opportunities')
      .select('id, stage, amount, created_at')
      .eq('project_id', ctx.projectId)
      .gte('created_at', startDt)
      .lte('created_at', endDt)
      .is('deleted_at', null);
    if (user_id) oppQuery = oppQuery.eq('owner_id', user_id);
    const { data: opps } = await oppQuery;

    return JSON.stringify({
      period: { start: startDt, end: endDt },
      activity_count: activities?.length ?? 0,
      opportunities_created: opps?.length ?? 0,
      pipeline_value: (opps ?? []).reduce((sum: number, o: any) => sum + ((o.amount as number) ?? 0), 0),
    });
  },
});

// ── Call Metrics Tool ───────────────────────────────────────────────────────

defineTool({
  name: 'calls.metrics',
  description: 'Get call analytics and metrics for a date range',
  minRole: 'viewer',
  parameters: z.object({
    start_date: z.string().describe('Start date (ISO format)'),
    end_date: z.string().describe('End date (ISO format)'),
    user_id: z.string().uuid().optional().describe('Filter by user'),
  }),
  handler: async (params, ctx) => {
    const { start_date, end_date, user_id } = params as any;
    let query = ctx.supabase
      .from('calls')
      .select('id, direction, status, duration, disposition, user_id')
      .eq('project_id', ctx.projectId)
      .gte('created_at', start_date)
      .lte('created_at', end_date);
    if (user_id) query = query.eq('user_id', user_id);
    const { data, error } = await query;
    if (error) throw new Error(`Failed to get call metrics: ${error.message}`);

    const calls = data ?? [];
    const totalCalls = calls.length;
    const inbound = calls.filter((c: any) => c.direction === 'inbound').length;
    const outbound = calls.filter((c: any) => c.direction === 'outbound').length;
    const totalDuration = calls.reduce((sum: number, c: any) => sum + ((c.duration as number) ?? 0), 0);
    const dispositions: Record<string, number> = {};
    for (const c of calls) {
      const d = ((c as any).disposition as string) ?? 'unknown';
      dispositions[d] = (dispositions[d] ?? 0) + 1;
    }

    return JSON.stringify({
      total_calls: totalCalls,
      inbound,
      outbound,
      total_duration_seconds: totalDuration,
      avg_duration_seconds: totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0,
      by_disposition: dispositions,
    });
  },
});

// ── RFP Stats Tool ──────────────────────────────────────────────────────────

defineTool({
  name: 'rfps.stats',
  description: 'Get RFP summary statistics: total count, by status, win rate, upcoming deadlines',
  minRole: 'viewer',
  parameters: z.object({}),
  handler: async (_params, ctx) => {
    const { data, error } = await ctx.supabase
      .from('rfps')
      .select('id, status, due_date, estimated_value')
      .eq('project_id', ctx.projectId)
      .is('deleted_at', null);
    if (error) throw new Error(`Failed to get RFP stats: ${error.message}`);

    const rfps = data ?? [];
    const total = rfps.length;
    const byStatus: Record<string, number> = {};
    let totalValue = 0;
    let wonCount = 0;
    let decidedCount = 0;
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 86400000);
    let upcomingDeadlines = 0;

    for (const r of rfps) {
      const s = (r.status as string) ?? 'unknown';
      byStatus[s] = (byStatus[s] ?? 0) + 1;
      totalValue += ((r.estimated_value as number) ?? 0);
      if (s === 'won') { wonCount++; decidedCount++; }
      if (s === 'lost') decidedCount++;
      if (r.due_date) {
        const due = new Date(r.due_date as string);
        if (due >= now && due <= nextWeek) upcomingDeadlines++;
      }
    }

    return JSON.stringify({
      total,
      byStatus,
      winRate: decidedCount > 0 ? Math.round((wonCount / decidedCount) * 100) : 0,
      upcomingDeadlines,
      totalValue,
    });
  },
});

// ── Workflow Tools ─────────────────────────────────────────────────────────

defineTool({
  name: 'workflows.list',
  description: 'List workflows with pagination, filtering by active status and tags',
  minRole: 'viewer',
  parameters: z.object({
    page: z.number().int().min(1).default(1).describe('Page number'),
    limit: z.number().int().min(1).max(100).default(50).describe('Items per page'),
    is_active: z.boolean().optional().describe('Filter by active status'),
    tag: z.string().optional().describe('Filter by tag'),
    search: z.string().optional().describe('Search by name or description'),
  }),
  handler: async (params, ctx) => {
    const { page = 1, limit = 50, is_active, tag, search } = params as {
      page?: number; limit?: number; is_active?: boolean; tag?: string; search?: string;
    };
    const offset = (page - 1) * limit;

    let query = ctx.supabase
      .from('workflows')
      .select('id, name, description, is_active, is_template, trigger_type, current_version, execution_count, last_executed_at, tags, created_at, updated_at', { count: 'exact' })
      .eq('project_id', ctx.projectId);

    if (is_active !== undefined) query = query.eq('is_active', is_active);
    if (tag) query = query.contains('tags', [tag]);
    if (search) {
      const s = search.replace(/[%_\\]/g, '\\$&').replace(/"/g, '""').replace(/[,()]/g, '');
      query = query.or(`name.ilike."%${s}%",description.ilike."%${s}%"`);
    }

    query = query.order('updated_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw new Error(`Failed to list workflows: ${error.message}`);

    return JSON.stringify({
      workflows: data,
      pagination: { page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) },
    });
  },
});

defineTool({
  name: 'workflows.get',
  description: 'Get a workflow by ID with full definition (nodes, edges, trigger config)',
  minRole: 'viewer',
  parameters: z.object({
    workflow_id: z.string().uuid().describe('Workflow ID'),
  }),
  handler: async (params, ctx) => {
    const { data, error } = await ctx.supabase
      .from('workflows')
      .select('*')
      .eq('id', params.workflow_id as string)
      .eq('project_id', ctx.projectId)
      .single();

    if (error) throw new Error(`Workflow not found: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'workflows.create',
  description: `Create a new workflow with a visual node graph. Each node MUST have: id (string), type (one of: start, end, action, ai_agent, condition, switch, delay, loop, sub_workflow, mcp_tool, webhook, zapier), position ({x, y} coordinates for canvas layout), and data ({label, config: {}}). Every workflow needs exactly one "start" node and at least one "end" node. Edges connect nodes: {id, source, target}. If nodes/edges are omitted, a default start→end workflow is created. Positions should be spaced ~150px apart vertically (e.g. start at y:50, next at y:200, etc.) with x:250 as center.`,
  minRole: 'member',
  parameters: z.object({
    name: z.string().min(1).max(50).describe('Workflow name'),
    description: z.string().max(2000).optional().describe('Description'),
    trigger_type: z.string().default('manual').describe('Trigger type'),
    nodes: z.array(z.record(z.string(), z.unknown())).optional().describe('Workflow nodes array. Each node: {id, type, position: {x, y}, data: {label, config: {}}}. Valid types: start, end, action, ai_agent, condition, switch, delay, loop, sub_workflow, mcp_tool, webhook, zapier'),
    edges: z.array(z.record(z.string(), z.unknown())).optional().describe('Edges connecting nodes: {id, source, target}'),
    tags: z.array(z.string()).optional().describe('Tags'),
  }),
  handler: async (params, ctx) => {
    const { sanitizeWorkflowDefinition } = await import('@/lib/workflows/sanitize-nodes');

    const definition = sanitizeWorkflowDefinition(
      params.nodes as unknown[] | undefined,
      params.edges as unknown[] | undefined,
    );

    const { data, error } = await ctx.supabase
      .from('workflows')
      .insert({
        name: params.name as string,
        description: (params.description as string) ?? null,
        trigger_type: (params.trigger_type as string) ?? 'manual',
        trigger_config: {} as Json,
        definition: definition as unknown as Json,
        tags: (params.tags as string[]) ?? [],
        project_id: ctx.projectId,
        created_by: ctx.userId,
        current_version: 1,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create workflow: ${error.message}`);

    await ctx.supabase.from('workflow_versions').insert({
      workflow_id: data.id,
      version: 1,
      definition: definition as unknown as Json,
      trigger_type: (params.trigger_type as string) ?? 'manual',
      trigger_config: {} as Json,
      change_summary: 'Initial creation',
      created_by: ctx.userId,
    });

    return JSON.stringify(data);
  },
});

defineTool({
  name: 'workflows.update',
  description: 'Update a workflow definition, name, or trigger config. Auto-creates a version.',
  minRole: 'member',
  parameters: z.object({
    workflow_id: z.string().uuid().describe('Workflow ID'),
    name: z.string().min(1).max(50).optional(),
    description: z.string().max(2000).optional(),
    trigger_type: z.string().optional(),
    nodes: z.array(z.record(z.string(), z.unknown())).optional().describe('Updated nodes'),
    edges: z.array(z.record(z.string(), z.unknown())).optional().describe('Updated edges'),
    change_summary: z.string().optional().describe('Description of changes'),
  }),
  handler: async (params, ctx) => {
    const id = params.workflow_id as string;

    const { data: current, error: getError } = await ctx.supabase
      .from('workflows')
      .select('current_version, definition, trigger_type, trigger_config')
      .eq('id', id)
      .eq('project_id', ctx.projectId)
      .single();

    if (getError) throw new Error(`Workflow not found: ${getError.message}`);

    const definitionChanged = params.nodes !== undefined || params.edges !== undefined || params.trigger_type !== undefined;
    const newVersion = definitionChanged ? (current.current_version ?? 0) + 1 : current.current_version;
    const updateData: Record<string, unknown> = {};
    if (definitionChanged) updateData.current_version = newVersion;
    if (params.name !== undefined) updateData.name = params.name;
    if (params.description !== undefined) updateData.description = params.description;
    if (params.trigger_type !== undefined) updateData.trigger_type = params.trigger_type;

    const existingDef = current.definition as { schema_version: string; nodes: unknown[]; edges: unknown[] };
    if (params.nodes !== undefined || params.edges !== undefined) {
      const { sanitizeWorkflowDefinition } = await import('@/lib/workflows/sanitize-nodes');
      const sanitized = sanitizeWorkflowDefinition(
        (params.nodes as unknown[] | undefined) ?? existingDef.nodes,
        (params.edges as unknown[] | undefined) ?? existingDef.edges,
      );
      updateData.definition = sanitized;
    }

    const { data, error } = await ctx.supabase
      .from('workflows')
      .update(updateData)
      .eq('id', id)
      .eq('project_id', ctx.projectId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update workflow: ${error.message}`);

    // Only create version record when definition/trigger changes
    if (definitionChanged) {
      await ctx.supabase.from('workflow_versions').insert({
        workflow_id: id,
        version: newVersion,
        definition: (updateData.definition ?? current.definition) as Json,
        trigger_type: (params.trigger_type as string) ?? current.trigger_type,
        trigger_config: current.trigger_config as Json,
        change_summary: (params.change_summary as string) ?? 'Updated via chat',
        created_by: ctx.userId,
      });
    }

    return JSON.stringify(data);
  },
});

defineTool({
  name: 'workflows.delete',
  description: 'Delete a workflow permanently',
  minRole: 'admin',
  parameters: z.object({
    workflow_id: z.string().uuid().describe('Workflow ID'),
  }),
  handler: async (params, ctx) => {
    const { error } = await ctx.supabase
      .from('workflows')
      .delete()
      .eq('id', params.workflow_id as string)
      .eq('project_id', ctx.projectId);

    if (error) throw new Error(`Failed to delete workflow: ${error.message}`);
    return JSON.stringify({ deleted: true, id: params.workflow_id });
  },
});

defineTool({
  name: 'workflows.activate',
  description: 'Toggle a workflow active/inactive. Validates definition before activation.',
  minRole: 'admin',
  parameters: z.object({
    workflow_id: z.string().uuid().describe('Workflow ID'),
    active: z.boolean().optional().describe('Explicitly set active state. Omit to toggle.'),
  }),
  handler: async (params, ctx) => {
    const { validateWorkflow } = await import('@/lib/workflows/validators/validate-workflow');

    const { data: workflow, error: getError } = await ctx.supabase
      .from('workflows')
      .select('*')
      .eq('id', params.workflow_id as string)
      .eq('project_id', ctx.projectId)
      .single();

    if (getError) throw new Error(`Workflow not found: ${getError.message}`);

    const newActive = params.active !== undefined ? (params.active as boolean) : !workflow.is_active;

    if (newActive) {
      try {
        const def = workflow.definition as unknown as Parameters<typeof validateWorkflow>[0];
        const errors = validateWorkflow(def);
        const blockers = errors.filter((e) => e.severity === 'error');
        if (blockers.length > 0) {
          return JSON.stringify({ error: 'Validation failed', validation_errors: blockers });
        }
      } catch {
        return JSON.stringify({ error: 'Workflow definition is malformed and cannot be validated' });
      }
    }

    const { data, error } = await ctx.supabase
      .from('workflows')
      .update({ is_active: newActive })
      .eq('id', params.workflow_id as string)
      .eq('project_id', ctx.projectId)
      .select()
      .single();

    if (error) throw new Error(`Failed to toggle workflow: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'workflows.execute',
  description: 'Manually trigger a workflow execution with optional context data',
  minRole: 'member',
  parameters: z.object({
    workflow_id: z.string().uuid().describe('Workflow ID'),
    context_data: z.record(z.string(), z.unknown()).optional().describe('Initial context data'),
  }),
  handler: async (params, ctx) => {
    const { data: workflow, error: getError } = await ctx.supabase
      .from('workflows')
      .select('id, current_version, definition')
      .eq('id', params.workflow_id as string)
      .eq('project_id', ctx.projectId)
      .single();

    if (getError) throw new Error(`Workflow not found: ${getError.message}`);

    // Use RPC for atomic execution creation + count increment (matches MCP tool & API route)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: executionId, error: rpcError } = await (ctx.supabase as any).rpc('log_workflow_execution', {
      p_workflow_id: workflow.id,
      p_workflow_version: workflow.current_version,
      p_trigger_event: { type: 'manual', user_id: ctx.userId },
      p_status: 'running',
    });

    if (rpcError || !executionId) throw new Error(`Failed to start execution: ${rpcError?.message ?? 'unknown'}`);

    // Set context_data on the execution (RPC doesn't accept it)
    const contextData = (params.context_data as Record<string, unknown>) ?? {};
    if (Object.keys(contextData).length > 0) {
      await ctx.supabase.from('workflow_executions')
        .update({ context_data: contextData as unknown as Json })
        .eq('id', executionId);
    }

    // Fire workflow engine asynchronously (don't block the response)
    import('@/lib/workflows/engine').then(({ executeWorkflow }) => {
      executeWorkflow(workflow.id, executionId as string, ctx.projectId, workflow.definition as unknown as Parameters<typeof executeWorkflow>[3], contextData).catch(async (err) => {
        console.error('Chat workflow execution error:', err);
        await ctx.supabase.from('workflow_executions')
          .update({ status: 'failed', error_message: err instanceof Error ? err.message : String(err), completed_at: new Date().toISOString() })
          .eq('id', executionId);
      });
    });

    // Fetch execution for response
    const { data: execution } = await ctx.supabase
      .from('workflow_executions').select('*').eq('id', executionId).single();

    return JSON.stringify(execution);
  },
});

defineTool({
  name: 'workflows.executions',
  description: 'List recent executions of a workflow with status filtering',
  minRole: 'viewer',
  parameters: z.object({
    workflow_id: z.string().uuid().describe('Workflow ID'),
    limit: z.number().int().min(1).max(100).default(20).describe('Max results'),
    status: z.enum(['running', 'completed', 'failed', 'cancelled', 'paused']).optional().describe('Filter by status'),
  }),
  handler: async (params, ctx) => {
    // Verify workflow belongs to this project first
    const { data: wf, error: wfErr } = await ctx.supabase
      .from('workflows').select('id').eq('id', params.workflow_id as string).eq('project_id', ctx.projectId).single();
    if (wfErr || !wf) throw new Error('Workflow not found in this project');

    let query = ctx.supabase
      .from('workflow_executions')
      .select('*')
      .eq('workflow_id', params.workflow_id as string)
      .order('started_at', { ascending: false })
      .limit((params.limit as number) ?? 20);

    if (params.status) query = query.eq('status', params.status as string);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to list executions: ${error.message}`);

    return JSON.stringify({ executions: data });
  },
});

defineTool({
  name: 'workflows.validate',
  description: 'Validate a workflow definition. Returns errors and warnings without saving.',
  minRole: 'viewer',
  parameters: z.object({
    nodes: z.array(z.record(z.string(), z.unknown())).describe('Workflow nodes'),
    edges: z.array(z.record(z.string(), z.unknown())).describe('Workflow edges'),
  }),
  handler: async (params) => {
    const { validateWorkflow } = await import('@/lib/workflows/validators/validate-workflow');

    const definition = {
      schema_version: '1.0.0',
      nodes: params.nodes as unknown[],
      edges: params.edges as unknown[],
    };

    const errors = validateWorkflow(definition as Parameters<typeof validateWorkflow>[0]);
    const hasErrors = errors.some((e) => e.severity === 'error');

    return JSON.stringify({
      valid: !hasErrors,
      errors: errors.filter((e) => e.severity === 'error'),
      warnings: errors.filter((e) => e.severity === 'warning'),
    });
  },
});

// ── Report Tools ────────────────────────────────────────────────────────────

defineTool({
  name: 'reports.get_schema',
  description: 'Get the schema of all reportable CRM objects, their fields (with types, aggregatable/groupable flags), and relationships. Always call this first before building a custom report to discover available data sources and field names.',
  minRole: 'viewer',
  parameters: z.object({}),
  handler: async (_params, ctx) => {
    const { getReportSchema } = await import('@/lib/reports/schema-registry');
    const schema = await getReportSchema(ctx.projectId);

    const simplified: Record<string, unknown> = {};
    for (const [key, obj] of Object.entries(schema.objects)) {
      simplified[key] = {
        label: obj.labelPlural,
        fields: obj.fields
          .filter((f) => f.name !== 'id' && f.name !== 'project_id' && f.name !== 'deleted_at')
          .map((f) => ({
            name: f.name,
            label: f.label,
            type: f.type,
            aggregatable: f.aggregatable,
            groupable: f.groupable,
            ...(f.enumValues ? { enumValues: f.enumValues } : {}),
          })),
        relations: obj.relations.map((r) => ({
          name: r.name,
          label: r.label,
          target: r.targetObject,
          type: r.type,
        })),
      };
    }

    return JSON.stringify(simplified, null, 2);
  },
});

defineTool({
  name: 'reports.preview',
  description: 'Run an ad-hoc report preview without saving. Returns up to 100 rows. Use this to test a report configuration before saving. The config needs: primaryObject (table name), columns (array of {objectName, fieldName}), and optionally filters, groupBy, aggregations.',
  minRole: 'viewer',
  parameters: z.object({
    primaryObject: z.string().describe('Primary table name, e.g. "opportunities"'),
    columns: z.array(z.object({
      objectName: z.string().describe('Table name'),
      fieldName: z.string().describe('Column name'),
      alias: z.string().optional(),
      aggregation: z.enum(['sum', 'avg', 'count', 'min', 'max', 'count_distinct']).optional(),
    })).min(1).describe('Fields to include'),
    filters: z.array(z.object({
      objectName: z.string(),
      fieldName: z.string(),
      operator: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'in', 'is_null', 'is_not_null', 'between']),
      value: z.unknown().optional(),
      value2: z.unknown().optional(),
    })).default([]).describe('Filter conditions'),
    groupBy: z.array(z.string()).optional().describe('Fields to group by'),
    aggregations: z.array(z.object({
      objectName: z.string(),
      fieldName: z.string(),
      function: z.enum(['sum', 'avg', 'count', 'min', 'max', 'count_distinct']),
      alias: z.string(),
    })).optional().describe('Aggregation functions'),
    orderBy: z.array(z.object({
      field: z.string(),
      direction: z.enum(['asc', 'desc']),
    })).optional(),
    limit: z.number().int().min(1).max(10000).optional(),
    chartType: z.enum(['table', 'bar', 'line', 'pie', 'funnel']).optional(),
  }),
  handler: async (params, ctx) => {
    const { executeCustomReport, ReportQueryError } = await import('@/lib/reports/query-engine');
    try {
      const config = params as unknown as import('@/lib/reports/types').CustomReportConfig;
      const result = await executeCustomReport(ctx.supabase, config, ctx.projectId, { preview: true });
      return JSON.stringify({
        totalRows: result.totalRows,
        truncated: result.truncated,
        executionMs: result.executionMs,
        columns: result.columns,
        rows: result.rows.slice(0, 20),
        ...(result.rows.length > 20 ? { note: `Showing 20 of ${result.rows.length} preview rows` } : {}),
      }, null, 2);
    } catch (error) {
      const message = error instanceof ReportQueryError ? error.message : 'Report preview failed';
      return JSON.stringify({ error: message });
    }
  },
});

defineTool({
  name: 'reports.create_custom',
  description: 'Save a new custom report. The report will appear in the Reports page for all users (if public) or just the creator (if private). Always preview first before saving.',
  minRole: 'member',
  parameters: z.object({
    name: z.string().min(1).max(255).describe('Report name'),
    description: z.string().max(1000).optional().describe('Report description'),
    primaryObject: z.string().describe('Primary table name'),
    columns: z.array(z.object({
      objectName: z.string(),
      fieldName: z.string(),
      alias: z.string().optional(),
      aggregation: z.enum(['sum', 'avg', 'count', 'min', 'max', 'count_distinct']).optional(),
    })).min(1),
    filters: z.array(z.object({
      objectName: z.string(),
      fieldName: z.string(),
      operator: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'in', 'is_null', 'is_not_null', 'between']),
      value: z.unknown().optional(),
      value2: z.unknown().optional(),
    })).default([]),
    groupBy: z.array(z.string()).optional(),
    aggregations: z.array(z.object({
      objectName: z.string(),
      fieldName: z.string(),
      function: z.enum(['sum', 'avg', 'count', 'min', 'max', 'count_distinct']),
      alias: z.string(),
    })).optional(),
    orderBy: z.array(z.object({ field: z.string(), direction: z.enum(['asc', 'desc']) })).optional(),
    chartType: z.enum(['table', 'bar', 'line', 'pie', 'funnel']).optional(),
    is_public: z.boolean().default(false),
  }),
  handler: async (params, ctx) => {
    const { name, description, is_public, ...configFields } = params as {
      name: string; description?: string; is_public: boolean;
      primaryObject: string; columns: unknown[]; filters: unknown[];
      groupBy?: string[]; aggregations?: unknown[]; orderBy?: unknown[]; chartType?: string;
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (ctx.supabase as any)
      .from('report_definitions')
      .insert({
        project_id: ctx.projectId,
        created_by: ctx.userId,
        name,
        description: description ?? null,
        report_type: 'custom',
        config: configFields,
        filters: {},
        is_public,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create report: ${error.message}`);

    return JSON.stringify({
      success: true,
      report_id: data.id,
      name: data.name,
      message: `Report "${data.name}" created successfully. It's now available in the Reports page.`,
    });
  },
});

// ── Exports ──────────────────────────────────────────────────────────────────

// OpenRouter requires tool names matching ^[a-zA-Z0-9_-]{1,64}$ (no dots)
function toApiName(name: string): string {
  return name.replace(/\./g, '_');
}

// ── Project Secrets Tools ────────────────────────────────────────────────────

defineTool({
  name: 'secrets.list',
  description: 'List all configured API keys for this project (shows masked values only)',
  minRole: 'admin',
  parameters: z.object({}),
  handler: async (_params, ctx) => {
    const { listProjectSecrets, SECRET_KEYS } = await import('@/lib/secrets');
    const stored = await listProjectSecrets(ctx.projectId);
    const allKeys = Object.entries(SECRET_KEYS).map(([key, meta]) => {
      const s = stored.find((r) => r.key_name === key);
      return {
        key_name: key,
        label: meta.label,
        description: meta.description,
        is_set: !!s,
        masked_value: s?.masked_value || '',
        has_env_fallback: !!process.env[meta.envVar],
      };
    });
    return JSON.stringify({ secrets: allKeys });
  },
});

defineTool({
  name: 'secrets.set',
  description: 'Set an API key for this project. Available keys: openrouter_api_key, fullenrich_api_key, news_api_key, census_api_key',
  minRole: 'admin',
  parameters: z.object({
    key_name: z.string().describe('Secret key name'),
    value: z.string().min(1).describe('The API key value'),
  }),
  handler: async (params, ctx) => {
    const keyName = params.key_name as string;
    const value = params.value as string;
    const secrets = await import('@/lib/secrets');
    if (!(keyName in secrets.SECRET_KEYS)) {
      throw new Error(`Invalid key name. Must be one of: ${Object.keys(secrets.SECRET_KEYS).join(', ')}`);
    }
    await secrets.setProjectSecret(ctx.projectId, keyName as import('@/lib/secrets').SecretKeyName, value, ctx.userId);
    return JSON.stringify({ success: true, message: `${keyName} has been saved` });
  },
});

defineTool({
  name: 'secrets.delete',
  description: 'Remove an API key from this project (will fall back to env var if set)',
  minRole: 'admin',
  parameters: z.object({
    key_name: z.string().describe('Secret key name to remove'),
  }),
  handler: async (params, ctx) => {
    const keyName = params.key_name as string;
    const secrets = await import('@/lib/secrets');
    if (!(keyName in secrets.SECRET_KEYS)) {
      throw new Error(`Invalid key name. Must be one of: ${Object.keys(secrets.SECRET_KEYS).join(', ')}`);
    }
    await secrets.deleteProjectSecret(ctx.projectId, keyName as import('@/lib/secrets').SecretKeyName);
    return JSON.stringify({ success: true, message: `${keyName} has been removed` });
  },
});

// ── Contract Tools ──────────────────────────────────────────────────────────

defineTool({
  name: 'contracts.list',
  description: 'List contract documents with pagination and filtering',
  minRole: 'viewer',
  parameters: z.object({
    page: z.number().int().min(1).default(1).describe('Page number'),
    limit: z.number().int().min(1).max(100).default(50).describe('Items per page'),
    search: z.string().optional().describe('Search by title'),
    status: z.string().optional().describe('Filter by status'),
  }),
  handler: async (params, ctx) => {
    const { page = 1, limit = 50, search, status } = params as {
      page?: number; limit?: number; search?: string; status?: string;
    };
    const offset = (page - 1) * limit;
    let query = ctx.supabase
      .from('contract_documents')
      .select('id, title, status, signing_order_type, original_file_name, created_at, sent_at, completed_at', { count: 'exact' })
      .eq('project_id', ctx.projectId)
      .is('deleted_at', null);
    if (search) {
      const sanitized = search.replace(/[%_\\]/g, '\\$&').replace(/"/g, '""');
      query = query.ilike('title', `%${sanitized}%`);
    }
    if (status) query = query.eq('status', status);
    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    const { data, error, count } = await query;
    if (error) throw new Error(`Failed: ${error.message}`);
    return JSON.stringify({ contracts: data, pagination: { page, limit, total: count ?? 0 } });
  },
});

defineTool({
  name: 'contracts.get',
  description: 'Get a contract document by ID with recipients',
  minRole: 'viewer',
  parameters: z.object({
    id: z.string().uuid().describe('Contract document ID'),
  }),
  handler: async (params, ctx) => {
    const id = params.id as string;
    const { data: doc, error } = await ctx.supabase
      .from('contract_documents')
      .select('*')
      .eq('id', id)
      .eq('project_id', ctx.projectId)
      .is('deleted_at', null)
      .single();
    if (error) throw new Error(`Not found: ${error.message}`);
    const { data: recipients } = await ctx.supabase
      .from('contract_recipients')
      .select('id, name, email, role, signing_order, status')
      .eq('document_id', id)
      .order('signing_order');
    return JSON.stringify({ ...doc, recipients: recipients ?? [] });
  },
});

defineTool({
  name: 'contracts.create',
  description: 'Create a new contract document from an uploaded PDF path',
  minRole: 'member',
  parameters: z.object({
    title: z.string().min(1).describe('Document title'),
    original_file_path: z.string().describe('Storage path from contract upload'),
    original_file_name: z.string().describe('Original PDF filename'),
    page_count: z.number().int().min(1).default(1).describe('PDF page count'),
    signing_order_type: z.enum(['sequential', 'parallel']).default('sequential'),
    opportunity_id: z.string().uuid().optional(),
    organization_id: z.string().uuid().optional(),
    person_id: z.string().uuid().optional(),
    description: z.string().optional(),
  }),
  handler: async (params, ctx) => {
    const payload = params as {
      title: string;
      original_file_path: string;
      original_file_name: string;
      page_count?: number;
      signing_order_type?: 'sequential' | 'parallel';
      opportunity_id?: string;
      organization_id?: string;
      person_id?: string;
      description?: string;
    };

    const { data, error } = await ctx.supabase
      .from('contract_documents')
      .insert({
        project_id: ctx.projectId,
        title: payload.title,
        description: payload.description ?? null,
        original_file_path: payload.original_file_path,
        original_file_name: payload.original_file_name,
        page_count: payload.page_count ?? 1,
        signing_order_type: payload.signing_order_type ?? 'sequential',
        opportunity_id: payload.opportunity_id ?? null,
        organization_id: payload.organization_id ?? null,
        person_id: payload.person_id ?? null,
        created_by: ctx.userId,
        owner_id: ctx.userId,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create contract: ${error.message}`);

    const { insertAuditTrail } = await import('@/lib/contracts/audit');
    insertAuditTrail({
      project_id: ctx.projectId,
      document_id: data.id,
      action: 'created',
      actor_type: 'user',
      actor_id: ctx.userId,
    });

    return JSON.stringify(data);
  },
});

defineTool({
  name: 'contracts.add_recipient',
  description: 'Add a signer recipient to a draft contract',
  minRole: 'member',
  parameters: z.object({
    document_id: z.string().uuid().describe('Contract document ID'),
    name: z.string().min(1).describe('Recipient name'),
    email: z.string().email().describe('Recipient email'),
    signing_order: z.number().int().min(1).default(1),
    person_id: z.string().uuid().optional(),
  }),
  handler: async (params, ctx) => {
    const payload = params as {
      document_id: string;
      name: string;
      email: string;
      signing_order?: number;
      person_id?: string;
    };

    const { data: doc } = await ctx.supabase
      .from('contract_documents')
      .select('id, status')
      .eq('id', payload.document_id)
      .eq('project_id', ctx.projectId)
      .is('deleted_at', null)
      .single();

    if (!doc) throw new Error('Document not found');
    if (doc.status !== 'draft') throw new Error('Can only add recipients to draft contracts');

    const { data, error } = await ctx.supabase
      .from('contract_recipients')
      .insert({
        project_id: ctx.projectId,
        document_id: payload.document_id,
        name: payload.name,
        email: payload.email,
        role: 'signer',
        signing_order: payload.signing_order ?? 1,
        person_id: payload.person_id ?? null,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to add recipient: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'contracts.add_field',
  description: 'Add a field to a draft contract for a signer recipient',
  minRole: 'member',
  parameters: z.object({
    document_id: z.string().uuid().describe('Contract document ID'),
    recipient_id: z.string().uuid().describe('Recipient ID on this contract'),
    field_type: z.enum(['signature', 'date_signed', 'text_input', 'checkbox', 'dropdown', 'name', 'email', 'company', 'title']),
    page_number: z.number().int().min(1).default(1),
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
    width: z.number().min(1).max(100).default(20),
    height: z.number().min(1).max(100).default(4),
    label: z.string().optional(),
    is_required: z.boolean().default(true),
  }),
  handler: async (params, ctx) => {
    const payload = params as {
      document_id: string;
      recipient_id: string;
      field_type: 'signature' | 'date_signed' | 'text_input' | 'checkbox' | 'dropdown' | 'name' | 'email' | 'company' | 'title';
      page_number?: number;
      x: number;
      y: number;
      width?: number;
      height?: number;
      label?: string;
      is_required?: boolean;
    };

    const { data: doc } = await ctx.supabase
      .from('contract_documents')
      .select('id, status')
      .eq('id', payload.document_id)
      .eq('project_id', ctx.projectId)
      .is('deleted_at', null)
      .single();

    if (!doc) throw new Error('Document not found');
    if (doc.status !== 'draft') throw new Error('Can only add fields to draft contracts');

    const { data: recipient } = await ctx.supabase
      .from('contract_recipients')
      .select('id, role')
      .eq('id', payload.recipient_id)
      .eq('document_id', payload.document_id)
      .eq('project_id', ctx.projectId)
      .single();

    if (!recipient) throw new Error('Recipient not found on this contract');
    if (recipient.role !== 'signer') throw new Error('Only signer recipients are currently supported');

    const { data, error } = await ctx.supabase
      .from('contract_fields')
      .insert({
        project_id: ctx.projectId,
        document_id: payload.document_id,
        recipient_id: payload.recipient_id,
        field_type: payload.field_type,
        page_number: payload.page_number ?? 1,
        x: payload.x,
        y: payload.y,
        width: payload.width ?? 20,
        height: payload.height ?? 4,
        label: payload.label ?? null,
        is_required: payload.is_required ?? true,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to add field: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'contracts.void',
  description: 'Void an active contract document',
  minRole: 'member',
  parameters: z.object({
    id: z.string().uuid().describe('Contract document ID'),
    reason: z.string().optional().describe('Reason for voiding'),
  }),
  handler: async (params, ctx) => {
    const id = params.id as string;
    const { data: voidedDoc, error } = await ctx.supabase
      .from('contract_documents')
      .update({ status: 'voided', voided_at: new Date().toISOString() })
      .eq('id', id)
      .eq('project_id', ctx.projectId)
      .is('deleted_at', null)
      .in('status', ['sent', 'viewed', 'partially_signed', 'expired', 'declined'])
      .select('id')
      .single();
    if (error || !voidedDoc) throw new Error(`Failed to void: ${error?.message ?? 'document state changed'}`);
    const { insertAuditTrail } = await import('@/lib/contracts/audit');
    insertAuditTrail({
      project_id: ctx.projectId,
      document_id: id,
      action: 'voided',
      actor_type: 'user',
      actor_id: ctx.userId,
      details: { reason: params.reason as string },
    });
    const { emitAutomationEvent } = await import('@/lib/automations/engine');
    emitAutomationEvent({
      projectId: ctx.projectId,
      triggerType: 'document.voided' as never,
      entityType: 'document' as never,
      entityId: id,
      data: { title: 'voided' },
    });
    return JSON.stringify({ success: true });
  },
});

defineTool({
  name: 'contracts.audit_trail',
  description: 'View the audit trail for a contract document',
  minRole: 'viewer',
  parameters: z.object({
    document_id: z.string().uuid().describe('Contract document ID'),
  }),
  handler: async (params, ctx) => {
    const documentId = params.document_id as string;
    const { data, error } = await ctx.supabase
      .from('contract_audit_trail')
      .select('*')
      .eq('document_id', documentId)
      .eq('project_id', ctx.projectId)
      .order('created_at', { ascending: true });

    if (error) throw new Error(`Failed to fetch audit trail: ${error.message}`);
    return JSON.stringify(data ?? []);
  },
});

defineTool({
  name: 'contracts.templates.list',
  description: 'List contract templates',
  minRole: 'viewer',
  parameters: z.object({}),
  handler: async (_params, ctx) => {
    const { data, error } = await ctx.supabase
      .from('contract_templates')
      .select('*')
      .eq('project_id', ctx.projectId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to list templates: ${error.message}`);
    return JSON.stringify(data ?? []);
  },
});

// ── Email Unknown Senders Tools ─────────────────────────────────────────────

defineTool({
  name: 'emails.unknown_senders',
  description: 'List inbound emails from unknown senders at known organizations. These are people who emailed from a known company domain but are not yet in the CRM.',
  minRole: 'viewer',
  parameters: z.object({
    organizationId: z.string().uuid().optional().describe('Filter by organization ID'),
    limit: z.number().int().min(1).max(100).default(50).describe('Max results'),
  }),
  handler: async (params, ctx) => {
    const { organizationId, limit = 50 } = params as { organizationId?: string; limit?: number };

    let query = ctx.supabase
      .from('emails')
      .select('from_email, from_name, organization_id, email_date')
      .eq('project_id', ctx.projectId)
      .is('person_id', null)
      .not('organization_id', 'is', null)
      .eq('direction', 'inbound')
      .order('email_date', { ascending: false });

    if (organizationId) query = query.eq('organization_id', organizationId);

    const { data: emails, error } = await query;
    if (error) throw new Error(`Failed to fetch: ${error.message}`);

    const senderMap = new Map<string, { from_email: string; from_name: string; organization_id: string; email_count: number; latest: string }>();
    for (const e of emails ?? []) {
      const key = `${e.from_email?.toLowerCase()}|${e.organization_id}`;
      const ex = senderMap.get(key);
      if (ex) { ex.email_count++; if (e.email_date > ex.latest) { ex.latest = e.email_date; if (e.from_name) ex.from_name = e.from_name; } }
      else senderMap.set(key, { from_email: e.from_email?.toLowerCase() ?? '', from_name: e.from_name ?? '', organization_id: e.organization_id!, email_count: 1, latest: e.email_date });
    }

    const senders = [...senderMap.values()].sort((a, b) => b.latest.localeCompare(a.latest)).slice(0, limit);
    const orgIds = [...new Set(senders.map(s => s.organization_id))];
    const orgMap = new Map<string, string>();
    if (orgIds.length > 0) {
      const { data: orgs } = await ctx.supabase.from('organizations').select('id, name').in('id', orgIds);
      for (const o of orgs ?? []) orgMap.set(o.id, o.name);
    }

    return JSON.stringify({ senders: senders.map(s => ({ ...s, organization_name: orgMap.get(s.organization_id) ?? 'Unknown' })), total: senderMap.size });
  },
});

defineTool({
  name: 'emails.create_contact_from_sender',
  description: 'Create a CRM contact from an unknown email sender and automatically link their historical emails to the new contact.',
  minRole: 'member',
  parameters: z.object({
    from_email: z.string().email().describe('The sender email address'),
    organization_id: z.string().uuid().describe('The organization to link the contact to'),
    first_name: z.string().optional().describe('First name (auto-parsed if omitted)'),
    last_name: z.string().optional().describe('Last name (auto-parsed if omitted)'),
    job_title: z.string().optional().describe('Job title'),
  }),
  handler: async (params, ctx) => {
    const normalizedEmail = (params as { from_email: string }).from_email.toLowerCase().trim();
    const { organization_id, job_title } = params as { organization_id: string; job_title?: string };
    let first_name = (params as { first_name?: string }).first_name;
    let last_name = (params as { last_name?: string }).last_name;

    const { data: existing } = await ctx.supabase.from('people').select('id').ilike('email', normalizedEmail).eq('project_id', ctx.projectId).is('deleted_at', null).limit(1).maybeSingle();
    if (existing) return JSON.stringify({ error: 'Contact already exists', person_id: existing.id });

    if (!first_name && !last_name) {
      const { data: recent } = await ctx.supabase.from('emails').select('from_name').ilike('from_email', normalizedEmail).eq('organization_id', organization_id).eq('project_id', ctx.projectId).not('from_name', 'is', null).order('email_date', { ascending: false }).limit(1).maybeSingle();
      if (recent?.from_name) { const parts = recent.from_name.trim().split(/\s+/); first_name = parts[0] ?? ''; last_name = parts.slice(1).join(' ') || ''; }
    }
    if (!first_name) { first_name = normalizedEmail.split('@')[0] ?? 'Unknown'; last_name = last_name || ''; }

    const { data: person, error } = await ctx.supabase.from('people').insert({ first_name, last_name: last_name || '', email: normalizedEmail, job_title: job_title || null, project_id: ctx.projectId, created_by: ctx.userId }).select().single();
    if (error) throw new Error(`Failed to create: ${error.message}`);

    await ctx.supabase.from('person_organizations').insert({ person_id: person.id, organization_id, project_id: ctx.projectId, is_primary: true, is_current: true });

    const { count } = await ctx.supabase.from('emails').update({ person_id: person.id }, { count: 'exact' }).ilike('from_email', normalizedEmail).eq('organization_id', organization_id).eq('project_id', ctx.projectId).is('person_id', null);

    emitAutomationEvent({ projectId: ctx.projectId, triggerType: 'entity.created', entityType: 'person', entityId: person.id, data: { ...person, source: 'unknown_sender_chat', emails_linked: count ?? 0 } });

    return JSON.stringify({ person, emails_linked: count ?? 0 });
  },
});

// ── Accounting Tools ──────────────────────────────────────────────────────────

defineTool({
  name: 'accounting.list_invoices',
  description: 'List invoices from the accounting module with optional status filter',
  minRole: 'viewer',
  parameters: z.object({
    status: z.enum(['draft', 'sent', 'partially_paid', 'paid', 'overdue', 'voided']).optional().describe('Filter by status'),
    limit: z.number().int().min(1).max(100).default(25).describe('Max results'),
  }),
  handler: async (params, ctx) => {
    const { data: membership } = await ctx.supabase.from('accounting_company_memberships').select('company_id').eq('user_id', ctx.userId).limit(1).maybeSingle();
    if (!membership) return JSON.stringify({ error: 'No accounting company found' });
    let query = ctx.supabase.from('invoices').select('id, invoice_number, customer_name, invoice_date, due_date, status, total, balance_due, currency').eq('company_id', membership.company_id).is('deleted_at', null).order('invoice_date', { ascending: false }).limit(params.limit as number);
    if (params.status) query = query.eq('status', params.status as string);
    const { data, error } = await query;
    if (error) throw new Error(`Failed: ${error.message}`);
    return JSON.stringify(data ?? []);
  },
});

defineTool({
  name: 'accounting.list_bills',
  description: 'List bills from the accounting module with optional status filter',
  minRole: 'viewer',
  parameters: z.object({
    status: z.enum(['draft', 'received', 'partially_paid', 'paid', 'overdue', 'voided']).optional().describe('Filter by status'),
    limit: z.number().int().min(1).max(100).default(25).describe('Max results'),
  }),
  handler: async (params, ctx) => {
    const { data: membership } = await ctx.supabase.from('accounting_company_memberships').select('company_id').eq('user_id', ctx.userId).limit(1).maybeSingle();
    if (!membership) return JSON.stringify({ error: 'No accounting company found' });
    let query = ctx.supabase.from('bills').select('id, bill_number, vendor_name, bill_date, due_date, status, total, balance_due, currency').eq('company_id', membership.company_id).is('deleted_at', null).order('bill_date', { ascending: false }).limit(params.limit as number);
    if (params.status) query = query.eq('status', params.status as string);
    const { data, error } = await query;
    if (error) throw new Error(`Failed: ${error.message}`);
    return JSON.stringify(data ?? []);
  },
});

defineTool({
  name: 'accounting.list_accounts',
  description: 'List chart of accounts from the accounting module',
  minRole: 'viewer',
  parameters: z.object({
    account_type: z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']).optional().describe('Filter by account type'),
  }),
  handler: async (params, ctx) => {
    const { data: membership } = await ctx.supabase.from('accounting_company_memberships').select('company_id').eq('user_id', ctx.userId).limit(1).maybeSingle();
    if (!membership) return JSON.stringify({ error: 'No accounting company found' });
    let query = ctx.supabase.from('chart_of_accounts').select('id, account_code, name, account_type, normal_balance, is_active').eq('company_id', membership.company_id).is('deleted_at', null).eq('is_active', true).order('account_code');
    if (params.account_type) query = query.eq('account_type', params.account_type as string);
    const { data, error } = await query;
    if (error) throw new Error(`Failed: ${error.message}`);
    return JSON.stringify(data ?? []);
  },
});

defineTool({
  name: 'accounting.list_recurring',
  description: 'List recurring transactions (scheduled invoices/bills)',
  minRole: 'viewer',
  parameters: z.object({
    active_only: z.boolean().default(true).describe('Show only active recurring transactions'),
  }),
  handler: async (params, ctx) => {
    const { data: membership } = await ctx.supabase.from('accounting_company_memberships').select('company_id').eq('user_id', ctx.userId).limit(1).maybeSingle();
    if (!membership) return JSON.stringify({ error: 'No accounting company found' });
    let query = ctx.supabase.from('recurring_transactions').select('id, name, type, counterparty_name, frequency, next_date, is_active, total_generated, currency, line_items').eq('company_id', membership.company_id).is('deleted_at', null).order('next_date');
    if (params.active_only) query = query.eq('is_active', true);
    const { data, error } = await query;
    if (error) throw new Error(`Failed: ${error.message}`);
    return JSON.stringify(data ?? []);
  },
});

defineTool({
  name: 'accounting.get_invoice',
  description: 'Get details of a specific invoice including line items',
  minRole: 'viewer',
  parameters: z.object({
    invoice_id: z.string().uuid().describe('The invoice ID'),
  }),
  handler: async (params, ctx) => {
    const { data: membership } = await ctx.supabase.from('accounting_company_memberships').select('company_id').eq('user_id', ctx.userId).limit(1).maybeSingle();
    if (!membership) return JSON.stringify({ error: 'No accounting company found' });
    const { data, error } = await ctx.supabase.from('invoices').select('*, invoice_line_items(*)').eq('id', params.invoice_id as string).eq('company_id', membership.company_id).is('deleted_at', null).single();
    if (error) throw new Error(`Failed: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'accounting.list_journal_entries',
  description: 'List journal entries from the accounting module',
  minRole: 'viewer',
  parameters: z.object({
    status: z.enum(['draft', 'posted', 'voided']).optional().describe('Filter by status'),
    limit: z.number().int().min(1).max(100).default(25).describe('Max results'),
  }),
  handler: async (params, ctx) => {
    const { data: membership } = await ctx.supabase.from('accounting_company_memberships').select('company_id').eq('user_id', ctx.userId).limit(1).maybeSingle();
    if (!membership) return JSON.stringify({ error: 'No accounting company found' });
    let query = ctx.supabase.from('journal_entries').select('id, entry_number, entry_date, memo, source_type, status').eq('company_id', membership.company_id).is('deleted_at', null).order('entry_date', { ascending: false }).limit(params.limit as number);
    if (params.status) query = query.eq('status', params.status as string);
    const { data, error } = await query;
    if (error) throw new Error(`Failed: ${error.message}`);
    return JSON.stringify(data ?? []);
  },
});

defineTool({
  name: 'accounting.record_payment',
  description: 'Record a payment received against an invoice',
  minRole: 'member',
  parameters: z.object({
    invoice_id: z.string().uuid().describe('The invoice to record payment for'),
    account_id: z.string().uuid().describe('Cash or bank account ID to receive the payment'),
    amount: z.number().positive().describe('Payment amount'),
    payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('Payment date (YYYY-MM-DD)'),
    payment_method: z.enum(['cash', 'check', 'credit_card', 'bank_transfer', 'ach', 'wire', 'other']).optional().describe('Payment method'),
    reference: z.string().optional().describe('Reference/check number'),
  }),
  handler: async (params, ctx) => {
    const { data, error } = await ctx.supabase.rpc('record_invoice_payment', {
      p_account_id: params.account_id as string,
      p_invoice_id: params.invoice_id as string,
      p_amount: params.amount as number,
      p_payment_date: params.payment_date as string,
      p_payment_method: (params.payment_method as string) ?? 'other',
      p_reference: (params.reference as string) ?? '',
    });
    if (error) throw new Error(`Failed: ${error.message}`);
    return JSON.stringify({ success: true, payment_id: data });
  },
});

// ── Calendar Tools ──────────────────────────────────────────────────────────

defineTool({
  name: 'calendar.list_event_types',
  description: 'List calendar event types for the current project',
  minRole: 'viewer',
  parameters: z.object({
    active_only: z.boolean().default(true).describe('Only return active event types'),
  }),
  handler: async (params, ctx) => {
    const { active_only } = params as { active_only: boolean };
    let query = ctx.supabase
      .from('event_types')
      .select('*')
      .eq('project_id', ctx.projectId)
      .order('created_at', { ascending: false });
    if (active_only) query = query.eq('is_active', true);
    const { data, error } = await query;
    if (error) throw new Error(`Failed: ${error.message}`);
    return JSON.stringify({ event_types: data });
  },
});

defineTool({
  name: 'calendar.get_event_type',
  description: 'Get a calendar event type by ID',
  minRole: 'viewer',
  parameters: z.object({
    id: z.string().uuid().describe('Event type ID'),
  }),
  handler: async (params, ctx) => {
    const { id } = params as { id: string };
    const { data, error } = await ctx.supabase
      .from('event_types')
      .select('*')
      .eq('id', id)
      .eq('project_id', ctx.projectId)
      .single();
    if (error) throw new Error(`Failed: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'calendar.create_event_type',
  description: 'Create a new calendar event type for booking',
  minRole: 'member',
  parameters: z.object({
    title: z.string().min(1).max(500).describe('Event type title'),
    slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/).describe('URL slug'),
    description: z.string().max(2000).optional().describe('Description'),
    duration_minutes: z.number().int().min(5).max(480).default(30).describe('Duration in minutes'),
    color: z.string().default('#3b82f6').describe('Color hex code'),
    location_type: z.enum(['video', 'phone', 'in_person', 'custom', 'ask_invitee']).default('video').describe('Location type'),
    buffer_before_minutes: z.number().int().min(0).default(0).describe('Buffer before'),
    buffer_after_minutes: z.number().int().min(0).default(0).describe('Buffer after'),
    min_notice_hours: z.number().int().min(0).default(24).describe('Min notice hours'),
    max_days_in_advance: z.number().int().min(1).default(60).describe('Max advance days'),
    requires_confirmation: z.boolean().default(false).describe('Require host confirmation'),
  }),
  handler: async (params, ctx) => {
    const p = params as Record<string, unknown>;
    const { data, error } = await ctx.supabase
      .from('event_types')
      .insert({
        user_id: ctx.userId,
        project_id: ctx.projectId,
        ...(p as any),
        description: (p.description as string) || null,
      })
      .select()
      .single();
    if (error) throw new Error(`Failed: ${error.message}`);
    emitAutomationEvent({
      projectId: ctx.projectId,
      triggerType: 'event_type.created',
      entityType: 'event_type',
      entityId: data.id,
      data: { event_type: data },
      metadata: { userId: ctx.userId },
    }).catch(() => {});
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'calendar.update_event_type',
  description: 'Update a calendar event type',
  minRole: 'member',
  parameters: z.object({
    id: z.string().uuid().describe('Event type ID'),
    title: z.string().min(1).max(500).optional().describe('Title'),
    slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/).optional().describe('URL slug'),
    description: z.string().max(2000).nullable().optional().describe('Description'),
    duration_minutes: z.number().int().min(5).max(480).optional().describe('Duration'),
    color: z.string().optional().describe('Color'),
    is_active: z.boolean().optional().describe('Active'),
    location_type: z.enum(['video', 'phone', 'in_person', 'custom', 'ask_invitee']).optional().describe('Location type'),
    requires_confirmation: z.boolean().optional().describe('Require confirmation'),
  }),
  handler: async (params, ctx) => {
    const { id, ...updates } = params as { id: string; [key: string]: unknown };
    const { data, error } = await ctx.supabase
      .from('event_types')
      .update(updates as any)
      .eq('id', id)
      .eq('project_id', ctx.projectId)
      .select()
      .single();
    if (error) throw new Error(`Failed: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'calendar.delete_event_type',
  description: 'Delete a calendar event type',
  minRole: 'member',
  parameters: z.object({
    id: z.string().uuid().describe('Event type ID'),
  }),
  handler: async (params, ctx) => {
    const { id } = params as { id: string };
    const { error } = await ctx.supabase
      .from('event_types')
      .delete()
      .eq('id', id)
      .eq('project_id', ctx.projectId);
    if (error) throw new Error(`Failed: ${error.message}`);
    return JSON.stringify({ deleted: true });
  },
});

defineTool({
  name: 'calendar.list_bookings',
  description: 'List bookings for the current project with optional status filter',
  minRole: 'viewer',
  parameters: z.object({
    status: z.enum(['pending', 'confirmed', 'cancelled', 'rescheduled', 'completed', 'no_show']).optional().describe('Filter by status'),
    limit: z.number().int().min(1).max(100).default(50).describe('Max results'),
  }),
  handler: async (params, ctx) => {
    const { status, limit } = params as { status?: string; limit: number };
    let query = ctx.supabase
      .from('bookings')
      .select('*, event_types(title, color, duration_minutes)')
      .eq('project_id', ctx.projectId)
      .order('start_at', { ascending: false })
      .limit(limit);
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw new Error(`Failed: ${error.message}`);
    return JSON.stringify({ bookings: data });
  },
});

defineTool({
  name: 'calendar.get_booking',
  description: 'Get a single booking by ID',
  minRole: 'viewer',
  parameters: z.object({
    id: z.string().uuid().describe('Booking ID'),
  }),
  handler: async (params, ctx) => {
    const { id } = params as { id: string };
    const { data, error } = await ctx.supabase
      .from('bookings')
      .select('*, event_types(title, color, duration_minutes, location_type)')
      .eq('id', id)
      .eq('project_id', ctx.projectId)
      .single();
    if (error) throw new Error(`Failed: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'calendar.cancel_booking',
  description: 'Cancel a booking (host action)',
  minRole: 'member',
  parameters: z.object({
    id: z.string().uuid().describe('Booking ID'),
    reason: z.string().max(2000).optional().describe('Cancellation reason'),
  }),
  handler: async (params, ctx) => {
    const { id, reason } = params as { id: string; reason?: string };
    const { data, error } = await ctx.supabase
      .from('bookings')
      .update({
        status: 'cancelled',
        cancelled_by: 'host',
        cancellation_reason: reason || null,
      })
      .eq('id', id)
      .eq('project_id', ctx.projectId)
      .in('status', ['confirmed', 'pending'])
      .select()
      .single();
    if (error) throw new Error(`Failed: ${error.message}`);
    emitAutomationEvent({
      projectId: ctx.projectId,
      triggerType: 'booking.cancelled',
      entityType: 'booking',
      entityId: data.id,
      data: { booking: data, cancelled_by: 'host' },
      metadata: { userId: ctx.userId },
    }).catch(() => {});
    sendBookingCancellation(data.id).catch(() => {});
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'calendar.update_profile',
  description: 'Update the current user\'s calendar booking profile',
  minRole: 'member',
  parameters: z.object({
    slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/).optional().describe('URL slug'),
    display_name: z.string().min(1).max(200).optional().describe('Display name'),
    bio: z.string().max(2000).nullable().optional().describe('Bio'),
    timezone: z.string().max(100).optional().describe('Timezone'),
    welcome_message: z.string().max(2000).nullable().optional().describe('Welcome message'),
  }),
  handler: async (params, ctx) => {
    const { data, error } = await ctx.supabase
      .from('calendar_profiles')
      .update(params as any)
      .eq('user_id', ctx.userId)
      .select()
      .single();
    if (error) throw new Error(`Failed: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'calendar.get_booking_link',
  description: 'Get the public booking URL for an event type',
  minRole: 'viewer',
  parameters: z.object({
    event_type_id: z.string().uuid().describe('Event type ID'),
  }),
  handler: async (params, ctx) => {
    const { event_type_id } = params as { event_type_id: string };
    const { data: et, error: etError } = await ctx.supabase
      .from('event_types')
      .select('slug, user_id')
      .eq('id', event_type_id)
      .eq('project_id', ctx.projectId)
      .single();
    if (etError) throw new Error(`Event type not found: ${etError.message}`);
    const { data: profile, error: profileError } = await ctx.supabase
      .from('calendar_profiles')
      .select('slug')
      .eq('user_id', et.user_id)
      .single();
    if (profileError) throw new Error(`Calendar profile not found: ${profileError.message}`);
    return JSON.stringify({ url: `/book/${profile.slug}/${et.slug}` });
  },
});

defineTool({
  name: 'calendar.list_availability_schedules',
  description: 'List the current user\'s availability schedules with rules',
  minRole: 'viewer',
  parameters: z.object({}),
  handler: async (_params, ctx) => {
    const { data, error } = await ctx.supabase
      .from('availability_schedules')
      .select('*, availability_rules(*)')
      .eq('user_id', ctx.userId);
    if (error) throw new Error(`Failed: ${error.message}`);
    return JSON.stringify({ schedules: data });
  },
});

defineTool({
  name: 'calendar.update_availability',
  description: 'Update an availability schedule and its rules',
  minRole: 'member',
  parameters: z.object({
    schedule_id: z.string().uuid().describe('Schedule ID'),
    name: z.string().min(1).max(200).optional().describe('Schedule name'),
    timezone: z.string().max(100).optional().describe('Timezone'),
    rules: z.array(z.object({
      day_of_week: z.number().int().min(0).max(6).describe('0=Sun, 6=Sat'),
      start_time: z.string().regex(/^\d{2}:\d{2}$/).describe('Start HH:MM'),
      end_time: z.string().regex(/^\d{2}:\d{2}$/).describe('End HH:MM'),
    })).optional().describe('Replacement rules'),
  }),
  handler: async (params, ctx) => {
    const { schedule_id, name, timezone, rules } = params as {
      schedule_id: string; name?: string; timezone?: string;
      rules?: { day_of_week: number; start_time: string; end_time: string }[];
    };
    // Verify schedule ownership
    const { data: schedule, error: schedError } = await ctx.supabase
      .from('availability_schedules')
      .select('id')
      .eq('id', schedule_id)
      .eq('user_id', ctx.userId)
      .single();
    if (schedError || !schedule) throw new Error('Schedule not found or access denied');

    if (name || timezone) {
      const updates: Record<string, string> = {};
      if (name) updates.name = name;
      if (timezone) updates.timezone = timezone;
      const { error } = await ctx.supabase
        .from('availability_schedules')
        .update(updates)
        .eq('id', schedule_id)
        .eq('user_id', ctx.userId);
      if (error) throw new Error(`Failed: ${error.message}`);
    }
    if (rules) {
      await ctx.supabase
        .from('availability_rules')
        .delete()
        .eq('schedule_id', schedule_id);
      if (rules.length > 0) {
        const { error } = await ctx.supabase
          .from('availability_rules')
          .insert(rules.map((r) => ({
            schedule_id,
            day_of_week: r.day_of_week,
            start_time: r.start_time,
            end_time: r.end_time,
          })));
        if (error) throw new Error(`Failed: ${error.message}`);
      }
    }
    const { data, error } = await ctx.supabase
      .from('availability_schedules')
      .select('*, availability_rules(*)')
      .eq('id', schedule_id)
      .single();
    if (error) throw new Error(`Failed: ${error.message}`);
    return JSON.stringify(data);
  },
});

export function getToolDefinitions(): ToolDefinition[] {
  return tools.map((tool) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Zod v4 type compat with zod-to-json-schema
    const schema = zodToJsonSchema(tool.parameters as any) as Record<string, unknown>;
    // Remove top-level $schema and additionalProperties that some providers reject
    delete schema.$schema;

    return {
      type: 'function' as const,
      function: {
        name: toApiName(tool.name),
        description: tool.description,
        parameters: schema,
      },
    };
  });
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: McpContext
): Promise<string> {
  // Accept both dotted (organizations.list) and underscored (organizations_list) names
  const tool = tools.find((t) => t.name === name || toApiName(t.name) === name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);

  checkPermission(ctx.role, tool.minRole);

  // Validate params against schema
  const parsed = tool.parameters.safeParse(args);
  if (!parsed.success) {
    throw new Error(`Invalid parameters for ${name}: ${parsed.error.message}`);
  }

  return tool.handler(parsed.data as Record<string, unknown>, ctx);
}

export function getToolNames(): string[] {
  return tools.map((t) => t.name);
}
