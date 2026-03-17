import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { checkPermission } from '@/lib/mcp/auth';
import { emitAutomationEvent } from '@/lib/automations/engine';
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
    id: z.string().uuid().describe('Organization ID'),
  }),
  handler: async (params, ctx) => {
    const { data, error } = await ctx.supabase
      .from('organizations')
      .select('*')
      .eq('id', params.id as string)
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
    id: z.string().uuid().describe('Organization ID'),
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
    const { id, custom_fields: cf, ...updates } = params as Record<string, unknown>;
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
    id: z.string().uuid().describe('Organization ID'),
  }),
  handler: async (params, ctx) => {
    const { data, error } = await ctx.supabase
      .from('organizations')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', params.id as string)
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
    id: z.string().uuid().describe('Organization ID'),
  }),
  handler: async (params, ctx) => {
    const { data: links, error: linkError } = await ctx.supabase
      .from('person_organizations')
      .select('person_id, job_title, department, is_primary')
      .eq('organization_id', params.id as string)
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
    id: z.string().uuid().describe('Person ID'),
  }),
  handler: async (params, ctx) => {
    const { data, error } = await ctx.supabase
      .from('people')
      .select('*')
      .eq('id', params.id as string)
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
    custom_fields: z.record(z.string(), z.unknown()).optional(),
  }),
  handler: async (params, ctx) => {
    const { id, custom_fields: cf, ...updates } = params as Record<string, unknown>;
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
    id: z.string().uuid().describe('Person ID'),
  }),
  handler: async (params, ctx) => {
    const { data, error } = await ctx.supabase
      .from('people')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', params.id as string)
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
    id: z.string().uuid().describe('Opportunity ID'),
  }),
  handler: async (params, ctx) => {
    const { data, error } = await ctx.supabase
      .from('opportunities')
      .select('*')
      .eq('id', params.id as string)
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
    id: z.string().uuid().describe('Opportunity ID'),
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
    const { id, custom_fields: cf, ...updates } = params as Record<string, unknown>;
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
    id: z.string().uuid().describe('Opportunity ID'),
  }),
  handler: async (params, ctx) => {
    const { data, error } = await ctx.supabase
      .from('opportunities')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', params.id as string)
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
  parameters: z.object({ id: z.string().uuid().describe('Task ID') }),
  handler: async (params, ctx) => {
    const { data, error } = await ctx.supabase.from('tasks').select('*').eq('id', params.id as string).eq('project_id', ctx.projectId).single();
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
    id: z.string().uuid().describe('Task ID'),
    title: z.string().min(1).max(500).optional(),
    description: z.string().max(5000).nullable().optional(),
    status: z.string().optional(),
    priority: z.string().optional(),
    assigned_to: z.string().uuid().nullable().optional(),
    due_date: z.string().nullable().optional(),
    completed_at: z.string().nullable().optional().describe('Set completion timestamp'),
  }),
  handler: async (params, ctx) => {
    const { id, ...updates } = params as Record<string, unknown>;
    const { data, error } = await ctx.supabase.from('tasks').update(updates as Record<string, unknown>).eq('id', id as string).eq('project_id', ctx.projectId).select().single();
    if (error) throw new Error(`Failed to update task: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'tasks.delete',
  description: 'Delete a task',
  minRole: 'member',
  parameters: z.object({ id: z.string().uuid().describe('Task ID') }),
  handler: async (params, ctx) => {
    const { error } = await ctx.supabase.from('tasks').delete().eq('id', params.id as string).eq('project_id', ctx.projectId);
    if (error) throw new Error(`Failed to delete task: ${error.message}`);
    return JSON.stringify({ deleted: true, id: params.id });
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
    id: z.string().uuid().describe('Note ID'),
    content: z.string().min(1).max(10000).optional(),
    is_pinned: z.boolean().optional(),
  }),
  handler: async (params, ctx) => {
    const { id, ...updates } = params as Record<string, unknown>;
    const { data, error } = await ctx.supabase.from('notes').update(updates as Record<string, unknown>).eq('id', id as string).eq('project_id', ctx.projectId).select().single();
    if (error) throw new Error(`Failed to update note: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'notes.delete',
  description: 'Delete a note',
  minRole: 'member',
  parameters: z.object({ id: z.string().uuid().describe('Note ID') }),
  handler: async (params, ctx) => {
    const { error } = await ctx.supabase.from('notes').delete().eq('id', params.id as string).eq('project_id', ctx.projectId);
    if (error) throw new Error(`Failed to delete note: ${error.message}`);
    return JSON.stringify({ deleted: true, id: params.id });
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
  parameters: z.object({ id: z.string().uuid().describe('RFP ID') }),
  handler: async (params, ctx) => {
    const { data, error } = await ctx.supabase.from('rfps').select('*').eq('id', params.id as string).eq('project_id', ctx.projectId).is('deleted_at', null).single();
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
    id: z.string().uuid().describe('RFP ID'),
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
    const { id, custom_fields: cf, ...updates } = params as Record<string, unknown>;
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
  parameters: z.object({ id: z.string().uuid().describe('RFP ID') }),
  handler: async (params, ctx) => {
    const { data, error } = await ctx.supabase.from('rfps').update({ deleted_at: new Date().toISOString() }).eq('id', params.id as string).eq('project_id', ctx.projectId).is('deleted_at', null).select().single();
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
  parameters: z.object({ id: z.string().uuid().describe('Sequence ID') }),
  handler: async (params, ctx) => {
    const { data: seq, error } = await ctx.supabase.from('sequences').select('*').eq('id', params.id as string).eq('project_id', ctx.projectId).single();
    if (error) throw new Error(`Sequence not found: ${error.message}`);

    const { data: steps } = await ctx.supabase.from('sequence_steps').select('*').eq('sequence_id', params.id as string).order('step_order', { ascending: true });

    const { count: enrollmentCount } = await ctx.supabase.from('sequence_enrollments').select('*', { count: 'exact', head: true }).eq('sequence_id', params.id as string);

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
    id: z.string().uuid().describe('Sequence ID'),
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).nullable().optional(),
    status: z.string().optional(),
  }),
  handler: async (params, ctx) => {
    const { id, ...updates } = params as Record<string, unknown>;
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
    id: z.string().uuid().describe('Meeting ID'),
    title: z.string().min(1).max(500).optional(),
    status: z.string().optional(),
    scheduled_at: z.string().optional(),
    duration_minutes: z.number().int().min(5).max(480).optional(),
    outcome: z.string().nullable().optional(),
    outcome_notes: z.string().max(5000).nullable().optional(),
    next_steps: z.string().max(5000).nullable().optional(),
  }),
  handler: async (params, ctx) => {
    const { id, ...updates } = params as Record<string, unknown>;
    const { data, error } = await ctx.supabase.from('meetings').update(updates as Record<string, unknown>).eq('id', id as string).eq('project_id', ctx.projectId).select().single();
    if (error) throw new Error(`Failed to update meeting: ${error.message}`);
    return JSON.stringify(data);
  },
});

defineTool({
  name: 'meetings.delete',
  description: 'Delete a meeting',
  minRole: 'member',
  parameters: z.object({ id: z.string().uuid().describe('Meeting ID') }),
  handler: async (params, ctx) => {
    const { error } = await ctx.supabase.from('meetings').delete().eq('id', params.id as string).eq('project_id', ctx.projectId);
    if (error) throw new Error(`Failed to delete meeting: ${error.message}`);
    return JSON.stringify({ deleted: true, id: params.id });
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

// ── Exports ──────────────────────────────────────────────────────────────────

// OpenRouter requires tool names matching ^[a-zA-Z0-9_-]{1,64}$ (no dots)
function toApiName(name: string): string {
  return name.replace(/\./g, '_');
}

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
