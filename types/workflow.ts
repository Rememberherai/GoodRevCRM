// Workflow types — modeled after cc-wf-studio's workflow-definition.ts
// Enterprise visual workflow builder with DAG-based orchestration

import type { ActionType, ConditionOperator, TriggerType } from './automation';

// Schema version for forward compatibility
export const WORKFLOW_SCHEMA_VERSION = '1.0.0';

// ============================================================================
// Node Types (12 types, matching cc-wf-studio's set adapted for CRM)
// ============================================================================

export type WorkflowNodeType =
  | 'start'           // Single entry point (cc-wf-studio: Start)
  | 'end'             // Terminal node(s) (cc-wf-studio: End)
  | 'action'          // Execute CRM action (cc-wf-studio: Prompt/SubAgent)
  | 'ai_agent'        // AI-driven decision/generation (cc-wf-studio: SubAgent)
  | 'condition'       // 2-way branch true/false (cc-wf-studio: IfElse)
  | 'switch'          // N-way branch with default (cc-wf-studio: Switch)
  | 'delay'           // Wait for duration or until date
  | 'loop'            // Iterate over a collection
  | 'sub_workflow'    // Nested workflow (cc-wf-studio: SubAgentFlow, max 30 nodes)
  | 'mcp_tool'        // Invoke MCP tool with 3 modes (cc-wf-studio: MCP)
  | 'webhook'         // External HTTP call
  | 'zapier';         // Zapier MCP action

// MCP node modes (matching cc-wf-studio's 3 modes)
export type McpNodeMode =
  | 'manual'          // User explicitly selects server/tool/parameters
  | 'ai_params'       // User selects tool, AI interprets natural language params
  | 'ai_selection';   // AI chooses the tool based on task description

// ============================================================================
// Workflow Trigger Types (extends automation triggers)
// ============================================================================

export type WorkflowTriggerType =
  | 'manual'             // Triggered by user action or API call
  | 'webhook_inbound'    // Triggered by incoming webhook
  | 'schedule'           // Triggered on a cron schedule
  | TriggerType;         // All automation trigger types

// ============================================================================
// Node Configuration Types
// ============================================================================

export interface StartNodeConfig {
  // No config needed — entry point
}

export interface EndNodeConfig {
  // No config needed — terminal
}

export interface ActionNodeConfig {
  action_type: ActionType;
  config: Record<string, unknown>;
}

export interface AiAgentNodeConfig {
  model: string;
  prompt: string;
  temperature?: number;
  output_key?: string;    // Key to store AI response in context_data
}

export interface ConditionNodeConfig {
  field: string;           // Supports dot notation for context_data paths
  operator: ConditionOperator;
  value: unknown;
}

export interface SwitchCase {
  value: unknown;
  label: string;
}

export interface SwitchNodeConfig {
  field: string;
  cases: SwitchCase[];
  default_label: string;
}

export interface DelayNodeConfig {
  delay_type: 'duration' | 'until_date' | 'until_field';
  duration_ms?: number;
  until_date?: string;
  field_path?: string;    // For 'until_field' — reads date from context
}

export interface LoopNodeConfig {
  collection_path: string;  // Path in context_data to iterate over
  item_key: string;         // Key name for current item in context
  max_iterations?: number;  // Safety limit
}

export interface SubWorkflowNodeConfig {
  workflow_id?: string;                   // Reference to existing workflow
  inline_definition?: WorkflowDefinition; // Or inline definition (max 30 nodes)
}

export interface McpToolNodeConfig {
  mode: McpNodeMode;
  server_url?: string;              // External MCP server URL, or 'internal'
  tool_name?: string;
  params?: Record<string, unknown>; // Tool parameters
  task_description?: string;        // For ai_params and ai_selection modes
  output_key?: string;
}

export interface WebhookNodeConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body_template?: string;      // JSON template with {{context.field}} placeholders
  payload_fields?: string[];   // Limit which context fields are sent (default: all)
  timeout_ms?: number;
  output_key?: string;
}

export interface ZapierNodeConfig {
  connection_id: string;    // References api_connections.id
  action: string;           // Zapier action name
  params: Record<string, unknown>;
  output_key?: string;
}

export type NodeConfig =
  | StartNodeConfig
  | EndNodeConfig
  | ActionNodeConfig
  | AiAgentNodeConfig
  | ConditionNodeConfig
  | SwitchNodeConfig
  | DelayNodeConfig
  | LoopNodeConfig
  | SubWorkflowNodeConfig
  | McpToolNodeConfig
  | WebhookNodeConfig
  | ZapierNodeConfig;

// ============================================================================
// Retry Configuration (per-node)
// ============================================================================

export interface RetryConfig {
  max_retries: number;
  backoff_ms: number;
  backoff_multiplier: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  max_retries: 3,
  backoff_ms: 1000,
  backoff_multiplier: 2,
};

// ============================================================================
// Core Node & Edge Types
// ============================================================================

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  position: { x: number; y: number };
  data: {
    label: string;
    description?: string;
    config: Record<string, unknown>;
    retry?: RetryConfig;
  };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;  // 'true'/'false' for condition, case labels for switch
  targetHandle?: string;
  label?: string;
  animated?: boolean;
}

export interface WorkflowDefinition {
  schema_version: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

// ============================================================================
// Validation Constraints (matching cc-wf-studio)
// ============================================================================

export const WORKFLOW_CONSTRAINTS = {
  MAX_NODES: 50,
  MAX_SUB_WORKFLOW_NODES: 30,
  MAX_EXECUTION_STEPS: 200,
  MAX_CHAIN_DEPTH: 3,
  NAME_MAX_LENGTH: 100,
  REQUIRED_START_NODES: 1,
  MIN_END_NODES: 1,
} as const;

// ============================================================================
// Validation Error
// ============================================================================

export interface WorkflowValidationError {
  code: string;
  message: string;
  nodeId?: string;
  edgeId?: string;
  severity: 'error' | 'warning';
}

// ============================================================================
// Database Record Types
// ============================================================================

export interface Workflow {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  is_template: boolean;
  trigger_type: WorkflowTriggerType;
  trigger_config: Record<string, unknown>;
  definition: WorkflowDefinition;
  current_version: number;
  execution_count: number;
  last_executed_at: string | null;
  tags: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface WorkflowVersion {
  id: string;
  workflow_id: string;
  version: number;
  definition: WorkflowDefinition;
  trigger_type: WorkflowTriggerType;
  trigger_config: Record<string, unknown>;
  change_summary: string | null;
  created_by: string;
  created_at: string;
}

export type WorkflowExecutionStatus =
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'paused';

export interface WorkflowExecution {
  id: string;
  workflow_id: string;
  workflow_version: number;
  trigger_event: Record<string, unknown>;
  status: WorkflowExecutionStatus;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
  entity_type: string | null;
  entity_id: string | null;
  context_data: Record<string, unknown>;
  created_at: string;
}

export type StepExecutionStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'waiting';

export interface WorkflowStepExecution {
  id: string;
  execution_id: string;
  node_id: string;
  node_type: WorkflowNodeType;
  status: StepExecutionStatus;
  input_data: Record<string, unknown> | null;
  output_data: Record<string, unknown> | null;
  error_message: string | null;
  retry_count: number;
  started_at: string | null;
  completed_at: string | null;
  scheduled_for: string | null;
  created_at: string;
}

export interface WorkflowWithStats extends Workflow {
  recent_executions?: WorkflowExecution[];
}

// ============================================================================
// API Connection Types
// ============================================================================

export type ApiConnectionServiceType =
  | 'zapier'
  | 'webhook'
  | 'oauth2'
  | 'api_key'
  | 'mcp';

export type ApiConnectionStatus =
  | 'active'
  | 'inactive'
  | 'expired'
  | 'error';

export interface ApiConnection {
  id: string;
  project_id: string;
  name: string;
  service_type: ApiConnectionServiceType;
  config_enc?: string;       // Encrypted — never exposed to client
  config_masked?: Record<string, unknown>;  // Masked version for display
  status: ApiConnectionStatus;
  last_used_at: string | null;
  last_health_check: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Node Palette Categories (for the visual editor left panel)
// ============================================================================

export interface NodePaletteItem {
  type: WorkflowNodeType;
  label: string;
  description: string;
  icon: string;       // Lucide icon name
  color: string;      // Tailwind color class
  category: NodePaletteCategory;
}

export type NodePaletteCategory = 'flow_control' | 'actions' | 'integrations';

export const NODE_PALETTE: NodePaletteItem[] = [
  // Flow Control
  { type: 'start', label: 'Start', description: 'Entry point of the workflow', icon: 'Play', color: 'emerald', category: 'flow_control' },
  { type: 'end', label: 'End', description: 'Terminal point of the workflow', icon: 'Square', color: 'red', category: 'flow_control' },
  { type: 'condition', label: 'Condition', description: 'Branch based on true/false', icon: 'GitBranch', color: 'amber', category: 'flow_control' },
  { type: 'switch', label: 'Switch', description: 'Multi-way branch with cases', icon: 'GitFork', color: 'amber', category: 'flow_control' },
  { type: 'delay', label: 'Delay', description: 'Wait for a duration or date', icon: 'Clock', color: 'orange', category: 'flow_control' },
  { type: 'loop', label: 'Loop', description: 'Iterate over a collection', icon: 'Repeat', color: 'cyan', category: 'flow_control' },
  // Actions
  { type: 'action', label: 'Automation Action', description: 'Execute a CRM automation action (create task, send email, etc.)', icon: 'Zap', color: 'blue', category: 'actions' },
  { type: 'ai_agent', label: 'AI Agent', description: 'AI-powered decision or content generation', icon: 'Brain', color: 'violet', category: 'actions' },
  { type: 'sub_workflow', label: 'Sub-Workflow', description: 'Run another workflow as a sub-step', icon: 'Layers', color: 'indigo', category: 'actions' },
  // Integrations
  { type: 'mcp_tool', label: 'CRM Action', description: 'Execute any CRM operation (create record, send email, look up data, etc.)', icon: 'Database', color: 'blue', category: 'actions' },
  { type: 'zapier', label: 'Zapier', description: 'Execute a Zapier action', icon: 'Bolt', color: 'orange', category: 'integrations' },
  { type: 'webhook', label: 'Webhook', description: 'Call an external HTTP endpoint', icon: 'Globe', color: 'teal', category: 'integrations' },
];

export const NODE_PALETTE_CATEGORIES: Record<NodePaletteCategory, string> = {
  flow_control: 'Flow Control',
  actions: 'Actions',
  integrations: 'Integrations',
};

// ============================================================================
// Node Color Map (for canvas and minimap coloring)
// ============================================================================

export const NODE_COLORS: Record<WorkflowNodeType, string> = {
  start: '#10b981',     // emerald-500
  end: '#ef4444',       // red-500
  action: '#3b82f6',    // blue-500
  ai_agent: '#8b5cf6',  // violet-500
  condition: '#f59e0b',  // amber-500
  switch: '#f59e0b',     // amber-500
  delay: '#f97316',      // orange-500
  loop: '#06b6d4',       // cyan-500
  sub_workflow: '#6366f1', // indigo-500
  mcp_tool: '#2563eb',    // blue-600
  zapier: '#ff4a00',      // Zapier orange
  webhook: '#14b8a6',     // teal-500
};
