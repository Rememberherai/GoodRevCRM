'use client';

import { type NodeProps } from '@xyflow/react';
import { Wrench } from 'lucide-react';
import { BaseNode } from './base-node';
import type { WorkflowNode } from '@/types/workflow';

export function McpToolNode(props: NodeProps) {
  const data = props.data as WorkflowNode['data'];
  const mode = (data.config?.mode as string) || 'manual';
  const toolName = (data.config?.tool_name as string) || '';

  const modeLabels: Record<string, string> = {
    manual: 'Manual',
    ai_params: 'AI Params',
    ai_selection: 'AI Select',
  };

  return (
    <BaseNode
      node={props}
      icon={<Wrench className="h-4 w-4 text-slate-600" />}
      color="border-slate-300"
      bgColor="bg-slate-50 dark:bg-slate-900"
    >
      <div className="text-[10px] text-slate-500 mt-1">
        {modeLabels[mode] || mode}
        {toolName && ` · ${toolName}`}
      </div>
    </BaseNode>
  );
}
