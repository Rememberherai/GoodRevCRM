'use client';

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useWorkflowStore } from '@/stores/workflow-store';
import { actionTypeOptions, conditionOperatorLabels } from '@/types/automation';
import type { WorkflowNodeType } from '@/types/workflow';

export function WorkflowPropertyPanel() {
  const {
    nodes,
    selectedNodeId,
    setSelectedNodeId,
    setPropertyPanelOpen,
    updateNodeData,
    removeNode,
  } = useWorkflowStore();

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  if (!selectedNode) return null;

  const { type, data } = selectedNode;
  const config = data.config || {};

  function updateConfig(key: string, value: unknown) {
    updateNodeData(selectedNode!.id, {
      config: { ...config, [key]: value },
    });
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Node Properties</h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => {
            setSelectedNodeId(null);
            setPropertyPanelOpen(false);
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Node label */}
      <div className="space-y-1.5">
        <Label className="text-xs">Label</Label>
        <Input
          value={data.label}
          onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })}
          className="h-8 text-sm"
        />
      </div>

      {/* Node description */}
      <div className="space-y-1.5">
        <Label className="text-xs">Description</Label>
        <Textarea
          value={data.description || ''}
          onChange={(e) => updateNodeData(selectedNode.id, { description: e.target.value })}
          className="text-sm min-h-[60px]"
          placeholder="Optional description..."
        />
      </div>

      {/* Type-specific config */}
      {renderTypeConfig(type, config, updateConfig)}

      {/* Delete button */}
      {type !== 'start' && (
        <div className="pt-4 border-t">
          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            onClick={() => removeNode(selectedNode.id)}
          >
            Delete Node
          </Button>
        </div>
      )}
    </div>
  );
}

function renderTypeConfig(
  type: WorkflowNodeType,
  config: Record<string, unknown>,
  updateConfig: (key: string, value: unknown) => void
) {
  switch (type) {
    case 'action':
      return (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Action Type</Label>
            <Select
              value={(config.action_type as string) || ''}
              onValueChange={(v) => updateConfig('action_type', v)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Select action..." />
              </SelectTrigger>
              <SelectContent>
                {actionTypeOptions.map((opt) => (
                  <SelectItem key={opt.type} value={opt.type}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      );

    case 'ai_agent':
      return (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Model</Label>
            <Select
              value={(config.model as string) || 'google/gemini-2.5-flash'}
              onValueChange={(v) => updateConfig('model', v)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="google/gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
                <SelectItem value="anthropic/claude-sonnet-4">Claude Sonnet 4</SelectItem>
                <SelectItem value="anthropic/claude-haiku-4">Claude Haiku 4</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Prompt</Label>
            <Textarea
              value={(config.prompt as string) || ''}
              onChange={(e) => updateConfig('prompt', e.target.value)}
              className="text-sm min-h-[100px]"
              placeholder="Describe what the AI should do..."
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Output Key</Label>
            <Input
              value={(config.output_key as string) || ''}
              onChange={(e) => updateConfig('output_key', e.target.value)}
              className="h-8 text-sm"
              placeholder="e.g. ai_response"
            />
          </div>
        </div>
      );

    case 'condition':
      return (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Field</Label>
            <Input
              value={(config.field as string) || ''}
              onChange={(e) => updateConfig('field', e.target.value)}
              className="h-8 text-sm"
              placeholder="e.g. context.stage"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Operator</Label>
            <Select
              value={(config.operator as string) || 'equals'}
              onValueChange={(v) => updateConfig('operator', v)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(conditionOperatorLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Value</Label>
            <Input
              value={String(config.value ?? '')}
              onChange={(e) => updateConfig('value', e.target.value)}
              className="h-8 text-sm"
              placeholder="Value to compare..."
            />
          </div>
        </div>
      );

    case 'delay':
      return (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Delay Type</Label>
            <Select
              value={(config.delay_type as string) || 'duration'}
              onValueChange={(v) => updateConfig('delay_type', v)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="duration">Duration</SelectItem>
                <SelectItem value="until_date">Until Date</SelectItem>
                <SelectItem value="until_field">Until Field Date</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(!config.delay_type || (config.delay_type as string) === 'duration') && (
            <div className="space-y-1.5">
              <Label className="text-xs">Duration (minutes)</Label>
              <Input
                type="number"
                value={((config.duration_ms as number) || 0) / 60000}
                onChange={(e) => updateConfig('duration_ms', Number(e.target.value) * 60000)}
                className="h-8 text-sm"
              />
            </div>
          )}
          {(config.delay_type as string) === 'until_date' && (
            <div className="space-y-1.5">
              <Label className="text-xs">Until Date (ISO 8601)</Label>
              <Input
                value={(config.until_date as string) || ''}
                onChange={(e) => updateConfig('until_date', e.target.value)}
                className="h-8 text-sm"
                placeholder="e.g. 2026-04-01T09:00:00Z"
              />
            </div>
          )}
          {(config.delay_type as string) === 'until_field' && (
            <div className="space-y-1.5">
              <Label className="text-xs">Field Path</Label>
              <Input
                value={(config.field_path as string) || ''}
                onChange={(e) => updateConfig('field_path', e.target.value)}
                className="h-8 text-sm"
                placeholder="e.g. context.due_date"
              />
            </div>
          )}
        </div>
      );

    case 'webhook':
      return (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">URL</Label>
            <Input
              value={(config.url as string) || ''}
              onChange={(e) => updateConfig('url', e.target.value)}
              className="h-8 text-sm"
              placeholder="https://..."
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Method</Label>
            <Select
              value={(config.method as string) || 'POST'}
              onValueChange={(v) => updateConfig('method', v)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      );

    case 'mcp_tool':
      return (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Mode</Label>
            <Select
              value={(config.mode as string) || 'manual'}
              onValueChange={(v) => updateConfig('mode', v)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual (select tool + params)</SelectItem>
                <SelectItem value="ai_params">AI Parameters (tool selected, AI fills params)</SelectItem>
                <SelectItem value="ai_selection">AI Selection (AI picks the tool)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {((config.mode as string) === 'manual' || (config.mode as string) === 'ai_params' || !config.mode) && (
            <div className="space-y-1.5">
              <Label className="text-xs">Tool Name</Label>
              <Input
                value={(config.tool_name as string) || ''}
                onChange={(e) => updateConfig('tool_name', e.target.value)}
                className="h-8 text-sm"
                placeholder="e.g. organizations.list"
              />
            </div>
          )}
          {((config.mode as string) === 'ai_params' || (config.mode as string) === 'ai_selection') && (
            <div className="space-y-1.5">
              <Label className="text-xs">Natural Language Prompt</Label>
              <Textarea
                value={(config.task_description as string) || ''}
                onChange={(e) => updateConfig('task_description', e.target.value)}
                className="text-sm min-h-[80px]"
                placeholder="Describe what tool to use and how..."
              />
            </div>
          )}
        </div>
      );

    case 'loop':
      return (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Collection Path</Label>
            <Input
              value={(config.collection_path as string) || ''}
              onChange={(e) => updateConfig('collection_path', e.target.value)}
              className="h-8 text-sm"
              placeholder="e.g. context.organizations"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Item Key</Label>
            <Input
              value={(config.item_key as string) || 'item'}
              onChange={(e) => updateConfig('item_key', e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        </div>
      );

    case 'zapier':
      return (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Connection</Label>
            <Input
              value={(config.connection_id as string) || ''}
              onChange={(e) => updateConfig('connection_id', e.target.value)}
              className="h-8 text-sm"
              placeholder="API Connection ID"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Action</Label>
            <Input
              value={(config.action as string) || ''}
              onChange={(e) => updateConfig('action', e.target.value)}
              className="h-8 text-sm"
              placeholder="Zapier action name"
            />
          </div>
        </div>
      );

    case 'sub_workflow':
      return (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Workflow ID (external)</Label>
            <Input
              value={(config.workflow_id as string) || ''}
              onChange={(e) => updateConfig('workflow_id', e.target.value)}
              className="h-8 text-sm"
              placeholder="Leave empty for inline sub-workflow"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Double-click this node on the canvas to edit its inline definition.
          </p>
        </div>
      );

    case 'switch':
      return (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Field</Label>
            <Input
              value={(config.field as string) || ''}
              onChange={(e) => updateConfig('field', e.target.value)}
              className="h-8 text-sm"
              placeholder="e.g. context.status"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Cases can be configured by adding edges with labels from this node.
          </p>
        </div>
      );

    default:
      return null;
  }
}
