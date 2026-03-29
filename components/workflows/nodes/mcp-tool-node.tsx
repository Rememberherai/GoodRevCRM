'use client';

import { type NodeProps } from '@xyflow/react';
import { Database } from 'lucide-react';
import { BaseNode } from './base-node';
import type { WorkflowNode } from '@/types/workflow';

const modeLabels: Record<string, string> = {
  manual: 'CRM Action',
  ai_params: 'AI-Assisted',
  ai_selection: 'Auto',
};

function formatToolName(raw: string): string {
  // "people.create" → "Create Person" style is handled externally;
  // here just make it readable: "organizations.list" → "organizations › list"
  return raw.replace('.', ' › ');
}

export function McpToolNode(props: NodeProps) {
  const data = props.data as WorkflowNode['data'];
  const mode = (data.config?.mode as string) || 'manual';
  const toolName = (data.config?.tool_name as string) || '';

  return (
    <BaseNode
      node={props}
      icon={<Database className="h-4 w-4 text-blue-600" />}
      color="border-blue-300"
      bgColor="bg-blue-50 dark:bg-blue-950"
    >
      <div className="text-[10px] text-blue-600 mt-1">
        {modeLabels[mode] || mode}
        {toolName && ` · ${formatToolName(toolName)}`}
      </div>
    </BaseNode>
  );
}
