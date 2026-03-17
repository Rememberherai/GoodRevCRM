import { z } from 'zod';
import { triggerTypes, automationEntityTypes } from './automation';

// ============================================================================
// Node & Edge Schemas
// ============================================================================

export const workflowNodeTypes = [
  'start', 'end', 'action', 'ai_agent', 'condition', 'switch',
  'delay', 'loop', 'sub_workflow', 'mcp_tool', 'webhook', 'zapier',
] as const;

export const mcpNodeModes = ['manual', 'ai_params', 'ai_selection'] as const;

export const workflowTriggerTypes = [
  'manual', 'webhook_inbound', 'schedule',
  ...triggerTypes,
] as const;

const positionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const retryConfigSchema = z.object({
  max_retries: z.number().min(0).max(10).default(3),
  backoff_ms: z.number().min(100).max(60000).default(1000),
  backoff_multiplier: z.number().min(1).max(5).default(2),
}).optional();

const nodeDataSchema = z.object({
  label: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  config: z.record(z.string(), z.unknown()).default({}),
  retry: retryConfigSchema,
});

const workflowNodeSchema = z.object({
  id: z.string().min(1).max(100),
  type: z.enum(workflowNodeTypes),
  position: positionSchema,
  data: nodeDataSchema,
});

const workflowEdgeSchema = z.object({
  id: z.string().min(1).max(100),
  source: z.string().min(1),
  target: z.string().min(1),
  sourceHandle: z.string().max(100).optional(),
  targetHandle: z.string().max(100).optional(),
  label: z.string().max(100).optional(),
  animated: z.boolean().optional(),
});

export const workflowDefinitionSchema = z.object({
  schema_version: z.string().default('1.0.0'),
  nodes: z.array(workflowNodeSchema).max(50),
  edges: z.array(workflowEdgeSchema).max(200),
});

// Trigger config extends automation trigger config + workflow-specific fields
const workflowTriggerConfigSchema = z.object({
  // Automation trigger config fields
  entity_type: z.enum(automationEntityTypes).optional(),
  field_name: z.string().optional(),
  to_value: z.string().optional(),
  from_value: z.string().optional(),
  from_stage: z.string().optional(),
  to_stage: z.string().optional(),
  from_status: z.string().optional(),
  to_status: z.string().optional(),
  sequence_id: z.string().uuid().optional(),
  meeting_type: z.string().optional(),
  outcome: z.string().optional(),
  disposition: z.string().optional(),
  direction: z.string().optional(),
  days: z.number().min(1).max(365).optional(),
  days_before: z.number().min(1).max(365).optional(),
  // Workflow-specific fields
  cron_expression: z.string().max(100).optional(),   // For 'schedule' trigger
  webhook_path: z.string().max(200).optional(),       // For 'webhook_inbound' trigger
}).passthrough();

// ============================================================================
// CRUD Schemas
// ============================================================================

export const createWorkflowSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(2000).nullable().optional(),
  is_active: z.boolean().optional().default(false),
  is_template: z.boolean().optional().default(false),
  trigger_type: z.enum(workflowTriggerTypes).default('manual'),
  trigger_config: workflowTriggerConfigSchema.default({}),
  definition: workflowDefinitionSchema.default({
    schema_version: '1.0.0',
    nodes: [],
    edges: [],
  }),
  tags: z.array(z.string().max(50)).max(20).optional().default([]),
});

export type CreateWorkflowInput = z.infer<typeof createWorkflowSchema>;

export const updateWorkflowSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(2000).nullable().optional(),
  is_active: z.boolean().optional(),
  is_template: z.boolean().optional(),
  trigger_type: z.enum(workflowTriggerTypes).optional(),
  trigger_config: workflowTriggerConfigSchema.optional(),
  definition: workflowDefinitionSchema.optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  change_summary: z.string().max(500).optional(),
});

export type UpdateWorkflowInput = z.infer<typeof updateWorkflowSchema>;

export const workflowQuerySchema = z.object({
  is_active: z.string().transform((v) => v === 'true').optional(),
  is_template: z.string().transform((v) => v === 'true').optional(),
  trigger_type: z.enum(workflowTriggerTypes).optional(),
  tag: z.string().max(50).optional(),
  search: z.string().max(200).optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});

export type WorkflowQueryInput = z.infer<typeof workflowQuerySchema>;

export const workflowExecutionQuerySchema = z.object({
  status: z.enum(['running', 'completed', 'failed', 'cancelled', 'paused']).optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});

export type WorkflowExecutionQueryInput = z.infer<typeof workflowExecutionQuerySchema>;

export const executeWorkflowSchema = z.object({
  entity_type: z.enum(automationEntityTypes).optional(),
  entity_id: z.string().uuid().optional(),
  context_data: z.record(z.string(), z.unknown()).optional().default({}),
});

export type ExecuteWorkflowInput = z.infer<typeof executeWorkflowSchema>;

export const validateWorkflowSchema = z.object({
  definition: workflowDefinitionSchema,
});

export type ValidateWorkflowInput = z.infer<typeof validateWorkflowSchema>;

// ============================================================================
// API Connection Schemas
// ============================================================================

export const apiConnectionServiceTypes = [
  'zapier', 'webhook', 'oauth2', 'api_key', 'mcp',
] as const;

export const createApiConnectionSchema = z.object({
  name: z.string().min(1).max(255),
  service_type: z.enum(apiConnectionServiceTypes),
  config: z.record(z.string(), z.unknown()),  // Will be encrypted before storage
});

export type CreateApiConnectionInput = z.infer<typeof createApiConnectionSchema>;

export const updateApiConnectionSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export type UpdateApiConnectionInput = z.infer<typeof updateApiConnectionSchema>;
