import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { checkPermission } from '../auth';
import { validateWorkflow } from '@/lib/workflows/validators/validate-workflow';
import { WORKFLOW_SCHEMA_VERSION } from '@/types/workflow';
import type { Json } from '@/types/database';
import type { McpContext } from '@/types/mcp';

export function registerWorkflowTools(server: McpServer, getContext: () => McpContext) {
  // workflows.list
  server.tool(
    'workflows.list',
    'List workflows with pagination, filtering by status and tags',
    {
      page: z.number().int().min(1).default(1).describe('Page number'),
      limit: z.number().int().min(1).max(100).default(50).describe('Items per page'),
      is_active: z.boolean().optional().describe('Filter by active status'),
      tag: z.string().optional().describe('Filter by tag'),
      search: z.string().optional().describe('Search by name or description'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'viewer');

      const { page, limit, is_active, tag, search } = params;
      const offset = (page - 1) * limit;

      let query = ctx.supabase
        .from('workflows')
        .select('id, name, description, is_active, is_template, trigger_type, current_version, execution_count, last_executed_at, tags, created_at, updated_at', { count: 'exact' })
        .eq('project_id', ctx.projectId);

      if (is_active !== undefined) query = query.eq('is_active', is_active);
      if (tag) query = query.contains('tags', [tag]);
      if (search) {
        const s = search.replace(/[%_\\]/g, '\\$&').replace(/"/g, '""');
        query = query.or(`name.ilike."%${s}%",description.ilike."%${s}%"`);
      }

      query = query.order('updated_at', { ascending: false }).range(offset, offset + limit - 1);

      const { data, error, count } = await query;
      if (error) throw new Error(`Failed to list workflows: ${error.message}`);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            workflows: data,
            pagination: { page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) },
          }),
        }],
      };
    }
  );

  // workflows.get
  server.tool(
    'workflows.get',
    'Get a workflow by ID with full definition (nodes, edges)',
    {
      id: z.string().uuid().describe('Workflow ID'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'viewer');

      const { data, error } = await ctx.supabase
        .from('workflows')
        .select('*')
        .eq('id', params.id)
        .eq('project_id', ctx.projectId)
        .single();

      if (error) throw new Error(`Workflow not found: ${error.message}`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
    }
  );

  // workflows.create
  server.tool(
    'workflows.create',
    'Create a new workflow with optional definition (nodes and edges)',
    {
      name: z.string().min(1).max(50).describe('Workflow name (lowercase alphanum, hyphens, underscores)'),
      description: z.string().max(2000).optional().describe('Workflow description'),
      trigger_type: z.string().default('manual').describe('Trigger type (manual, webhook_inbound, schedule, entity.created, etc.)'),
      trigger_config: z.record(z.string(), z.unknown()).optional().describe('Trigger configuration'),
      definition: z.object({
        schema_version: z.string().default(WORKFLOW_SCHEMA_VERSION),
        nodes: z.array(z.record(z.string(), z.unknown())).default([]),
        edges: z.array(z.record(z.string(), z.unknown())).default([]),
      }).optional().describe('Workflow graph definition with nodes and edges'),
      tags: z.array(z.string()).optional().describe('Tags for organization'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'member');

      const definition = params.definition ?? {
        schema_version: WORKFLOW_SCHEMA_VERSION,
        nodes: [
          { id: 'start-1', type: 'start', position: { x: 250, y: 50 }, data: { label: 'Start', config: {} } },
          { id: 'end-1', type: 'end', position: { x: 250, y: 300 }, data: { label: 'End', config: {} } },
        ],
        edges: [{ id: 'e-start-end', source: 'start-1', target: 'end-1' }],
      };

      const { data, error } = await ctx.supabase
        .from('workflows')
        .insert({
          name: params.name,
          description: params.description ?? null,
          trigger_type: params.trigger_type,
          trigger_config: (params.trigger_config ?? {}) as unknown as Json,
          definition: definition as unknown as Json,
          tags: params.tags ?? [],
          project_id: ctx.projectId,
          created_by: ctx.userId,
          current_version: 1,
        })
        .select()
        .single();

      if (error) throw new Error(`Failed to create workflow: ${error.message}`);

      // Create initial version
      await ctx.supabase.from('workflow_versions').insert({
        workflow_id: data.id,
        version: 1,
        definition: definition as unknown as Json,
        trigger_type: params.trigger_type,
        trigger_config: (params.trigger_config ?? {}) as unknown as Json,
        change_summary: 'Initial creation',
        created_by: ctx.userId,
      });

      return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
    }
  );

  // workflows.update
  server.tool(
    'workflows.update',
    'Update a workflow definition, name, description, or trigger config',
    {
      id: z.string().uuid().describe('Workflow ID'),
      name: z.string().min(1).max(50).optional(),
      description: z.string().max(2000).optional(),
      trigger_type: z.string().optional(),
      trigger_config: z.record(z.string(), z.unknown()).optional(),
      definition: z.object({
        schema_version: z.string().optional(),
        nodes: z.array(z.record(z.string(), z.unknown())).optional(),
        edges: z.array(z.record(z.string(), z.unknown())).optional(),
      }).optional().describe('Updated workflow definition'),
      change_summary: z.string().optional().describe('Description of changes for version history'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'member');

      const { id, change_summary, ...updates } = params;

      // Get current workflow for versioning
      const { data: current, error: getError } = await ctx.supabase
        .from('workflows')
        .select('current_version, definition, trigger_type, trigger_config')
        .eq('id', id)
        .eq('project_id', ctx.projectId)
        .single();

      if (getError) throw new Error(`Workflow not found: ${getError.message}`);

      const newVersion = (current.current_version ?? 0) + 1;
      const updateData: Record<string, unknown> = { current_version: newVersion };
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.trigger_type !== undefined) updateData.trigger_type = updates.trigger_type;
      if (updates.trigger_config !== undefined) updateData.trigger_config = updates.trigger_config;
      if (updates.definition !== undefined) {
        // Merge with current definition to prevent partial overwrites
        const currentDef = current.definition as { schema_version?: string; nodes?: unknown[]; edges?: unknown[] };
        updateData.definition = {
          schema_version: updates.definition.schema_version ?? currentDef.schema_version ?? '1.0.0',
          nodes: updates.definition.nodes ?? currentDef.nodes ?? [],
          edges: updates.definition.edges ?? currentDef.edges ?? [],
        };
      }

      const { data, error } = await ctx.supabase
        .from('workflows')
        .update(updateData)
        .eq('id', id)
        .eq('project_id', ctx.projectId)
        .select()
        .single();

      if (error) throw new Error(`Failed to update workflow: ${error.message}`);

      // Create version record
      await ctx.supabase.from('workflow_versions').insert({
        workflow_id: id,
        version: newVersion,
        definition: (updates.definition ?? current.definition) as unknown as Json,
        trigger_type: updates.trigger_type ?? current.trigger_type,
        trigger_config: (updates.trigger_config ?? current.trigger_config) as unknown as Json,
        change_summary: change_summary ?? 'Updated via MCP',
        created_by: ctx.userId,
      });

      return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
    }
  );

  // workflows.delete
  server.tool(
    'workflows.delete',
    'Delete a workflow permanently',
    {
      id: z.string().uuid().describe('Workflow ID'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'admin');

      const { error } = await ctx.supabase
        .from('workflows')
        .delete()
        .eq('id', params.id)
        .eq('project_id', ctx.projectId);

      if (error) throw new Error(`Failed to delete workflow: ${error.message}`);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ deleted: true, id: params.id }) }] };
    }
  );

  // workflows.activate
  server.tool(
    'workflows.activate',
    'Activate or deactivate a workflow. Validates the definition before activation.',
    {
      id: z.string().uuid().describe('Workflow ID'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'admin');

      const { data: workflow, error: getError } = await ctx.supabase
        .from('workflows')
        .select('*')
        .eq('id', params.id)
        .eq('project_id', ctx.projectId)
        .single();

      if (getError) throw new Error(`Workflow not found: ${getError.message}`);

      const newActive = !workflow.is_active;

      // Validate before activating
      if (newActive) {
        const def = workflow.definition as { schema_version: string; nodes: unknown[]; edges: unknown[] };
        const errors = validateWorkflow(def as Parameters<typeof validateWorkflow>[0]);
        const blockers = errors.filter((e) => e.severity === 'error');
        if (blockers.length > 0) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({ error: 'Validation failed', validation_errors: blockers }),
            }],
          };
        }
      }

      const { data, error } = await ctx.supabase
        .from('workflows')
        .update({ is_active: newActive })
        .eq('id', params.id)
        .eq('project_id', ctx.projectId)
        .select()
        .single();

      if (error) throw new Error(`Failed to toggle workflow: ${error.message}`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
    }
  );

  // workflows.execute
  server.tool(
    'workflows.execute',
    'Manually trigger a workflow execution',
    {
      id: z.string().uuid().describe('Workflow ID'),
      context_data: z.record(z.string(), z.unknown()).optional().describe('Initial context data for the execution'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'member');

      const { data: workflow, error: getError } = await ctx.supabase
        .from('workflows')
        .select('id, current_version, definition, execution_count')
        .eq('id', params.id)
        .eq('project_id', ctx.projectId)
        .single();

      if (getError) throw new Error(`Workflow not found: ${getError.message}`);

      const { data: execution, error } = await ctx.supabase
        .from('workflow_executions')
        .insert({
          workflow_id: workflow.id,
          workflow_version: workflow.current_version,
          trigger_event: { type: 'manual', user_id: ctx.userId } as unknown as Json,
          status: 'running',
          context_data: (params.context_data ?? {}) as unknown as Json,
        })
        .select()
        .single();

      if (error) throw new Error(`Failed to start execution: ${error.message}`);

      // Update execution count
      await ctx.supabase
        .from('workflows')
        .update({
          execution_count: (workflow.execution_count ?? 0) + 1,
          last_executed_at: new Date().toISOString(),
        })
        .eq('id', workflow.id);

      // Fire workflow engine asynchronously
      import('@/lib/workflows/engine').then(({ executeWorkflow }) => {
        executeWorkflow(workflow.id, execution.id, ctx.projectId, workflow.definition as unknown as Parameters<typeof executeWorkflow>[3], params.context_data ?? {}).catch((err) =>
          console.error('MCP workflow execution error:', err)
        );
      });

      return { content: [{ type: 'text' as const, text: JSON.stringify(execution) }] };
    }
  );

  // workflows.executions
  server.tool(
    'workflows.executions',
    'List recent executions of a workflow',
    {
      id: z.string().uuid().describe('Workflow ID'),
      limit: z.number().int().min(1).max(100).default(20).describe('Max results'),
      status: z.enum(['running', 'completed', 'failed', 'cancelled', 'paused']).optional().describe('Filter by status'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'viewer');

      let query = ctx.supabase
        .from('workflow_executions')
        .select('*')
        .eq('workflow_id', params.id)
        .order('started_at', { ascending: false })
        .limit(params.limit);

      if (params.status) query = query.eq('status', params.status);

      const { data, error } = await query;
      if (error) throw new Error(`Failed to list executions: ${error.message}`);

      return { content: [{ type: 'text' as const, text: JSON.stringify({ executions: data }) }] };
    }
  );

  // workflows.validate
  server.tool(
    'workflows.validate',
    'Validate a workflow definition without saving. Returns validation errors and warnings.',
    {
      definition: z.object({
        schema_version: z.string().default(WORKFLOW_SCHEMA_VERSION),
        nodes: z.array(z.record(z.string(), z.unknown())),
        edges: z.array(z.record(z.string(), z.unknown())),
      }).describe('Workflow definition to validate'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'viewer');

      const errors = validateWorkflow(params.definition as unknown as Parameters<typeof validateWorkflow>[0]);
      const hasErrors = errors.some((e) => e.severity === 'error');

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            valid: !hasErrors,
            errors: errors.filter((e) => e.severity === 'error'),
            warnings: errors.filter((e) => e.severity === 'warning'),
          }),
        }],
      };
    }
  );
}
