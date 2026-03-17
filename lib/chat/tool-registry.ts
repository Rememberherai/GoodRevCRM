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

// ── Exports ──────────────────────────────────────────────────────────────────

export function getToolDefinitions(): ToolDefinition[] {
  return tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Zod v4 type compat with zod-to-json-schema
      parameters: zodToJsonSchema(tool.parameters as any, { target: 'openAi' }) as Record<string, unknown>,
    },
  }));
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: McpContext
): Promise<string> {
  const tool = tools.find((t) => t.name === name);
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
