import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { checkPermission } from '../auth';
import { validateWorkflow } from '@/lib/workflows/validators/validate-workflow';
import { sanitizeWorkflowDefinition } from '@/lib/workflows/sanitize-nodes';
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
        const s = search.replace(/[%_\\]/g, '\\$&').replace(/"/g, '""').replace(/[,()]/g, '');
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
    `Create a new workflow with a visual node graph. Each node MUST have: id (string), type (one of: start, end, action, ai_agent, condition, switch, delay, loop, sub_workflow, mcp_tool, webhook, zapier), position ({x, y} coordinates), and data ({label, config: {}}). Every workflow needs one "start" node and at least one "end" node. Edges: {id, source, target}. Positions should be spaced ~150px apart vertically.`,
    {
      name: z.string().min(1).max(50).describe('Workflow name (lowercase alphanum, hyphens, underscores)'),
      description: z.string().max(2000).optional().describe('Workflow description'),
      trigger_type: z.string().default('manual').describe('Trigger type (manual, webhook_inbound, schedule, entity.created, etc.)'),
      trigger_config: z.record(z.string(), z.unknown()).optional().describe('Trigger configuration'),
      definition: z.object({
        schema_version: z.string().default(WORKFLOW_SCHEMA_VERSION),
        nodes: z.array(z.record(z.string(), z.unknown())).default([]),
        edges: z.array(z.record(z.string(), z.unknown())).default([]),
      }).optional().describe('Workflow graph definition. Nodes need: id, type (start|end|action|ai_agent|condition|switch|delay|loop|sub_workflow|mcp_tool|webhook|zapier), position ({x,y}), data ({label, config: {}})'),
      tags: z.array(z.string()).optional().describe('Tags for organization'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'member');

      const definition = sanitizeWorkflowDefinition(
        params.definition?.nodes as unknown[] | undefined,
        params.definition?.edges as unknown[] | undefined,
      );

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

      const definitionChanged = updates.definition !== undefined || updates.trigger_type !== undefined || updates.trigger_config !== undefined;
      const newVersion = definitionChanged ? (current.current_version ?? 0) + 1 : current.current_version;
      const updateData: Record<string, unknown> = {};
      if (definitionChanged) updateData.current_version = newVersion;
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.trigger_type !== undefined) updateData.trigger_type = updates.trigger_type;
      if (updates.trigger_config !== undefined) updateData.trigger_config = updates.trigger_config;
      if (updates.definition !== undefined) {
        const currentDef = current.definition as { schema_version?: string; nodes?: unknown[]; edges?: unknown[] };
        const mergedNodes = (updates.definition.nodes as unknown[] | undefined) ?? currentDef.nodes ?? [];
        const mergedEdges = (updates.definition.edges as unknown[] | undefined) ?? currentDef.edges ?? [];
        updateData.definition = sanitizeWorkflowDefinition(mergedNodes, mergedEdges);
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
          definition: (updateData.definition ?? current.definition) as unknown as Json,
          trigger_type: updates.trigger_type ?? current.trigger_type,
          trigger_config: (updates.trigger_config ?? current.trigger_config) as unknown as Json,
          change_summary: change_summary ?? 'Updated via MCP',
          created_by: ctx.userId,
        });
      }

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
    'Activate or deactivate a workflow. Pass active=true to activate or active=false to deactivate. Validates the definition before activation.',
    {
      id: z.string().uuid().describe('Workflow ID'),
      active: z.boolean().optional().describe('Set to true to activate, false to deactivate. If omitted, toggles the current state.'),
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

      const newActive = params.active !== undefined ? params.active : !workflow.is_active;

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
        .select('id, current_version, definition')
        .eq('id', params.id)
        .eq('project_id', ctx.projectId)
        .single();

      if (getError) throw new Error(`Workflow not found: ${getError.message}`);

      // Use RPC for atomic execution creation + count increment
      const { data: executionId, error: rpcError } = await ctx.supabase.rpc('log_workflow_execution', {
        p_workflow_id: workflow.id,
        p_workflow_version: workflow.current_version,
        p_trigger_event: { type: 'manual', user_id: ctx.userId },
        p_status: 'running',
      });

      if (rpcError || !executionId) throw new Error(`Failed to start execution: ${rpcError?.message ?? 'unknown'}`);

      // Set context_data on the execution (RPC doesn't accept it)
      if (params.context_data && Object.keys(params.context_data).length > 0) {
        await ctx.supabase.from('workflow_executions')
          .update({ context_data: params.context_data as unknown as Json })
          .eq('id', executionId);
      }

      // Fire workflow engine asynchronously
      import('@/lib/workflows/engine').then(({ executeWorkflow }) => {
        executeWorkflow(workflow.id, executionId, ctx.projectId, workflow.definition as unknown as Parameters<typeof executeWorkflow>[3], params.context_data ?? {}).catch(async (err) => {
          console.error('MCP workflow execution error:', err);
          await ctx.supabase.from('workflow_executions')
            .update({ status: 'failed', error_message: err instanceof Error ? err.message : String(err), completed_at: new Date().toISOString() })
            .eq('id', executionId);
        });
      });

      // Fetch execution for response
      const { data: execution } = await ctx.supabase
        .from('workflow_executions').select('*').eq('id', executionId).single();

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

      // Verify workflow belongs to this project first
      const { data: wf, error: wfErr } = await ctx.supabase
        .from('workflows').select('id').eq('id', params.id).eq('project_id', ctx.projectId).single();
      if (wfErr || !wf) throw new Error('Workflow not found in this project');

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
