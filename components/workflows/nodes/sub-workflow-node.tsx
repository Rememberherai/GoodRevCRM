'use client';

import { type NodeProps } from '@xyflow/react';
import { Layers } from 'lucide-react';
import { BaseNode } from './base-node';
import type { WorkflowNode } from '@/types/workflow';

export function SubWorkflowNode(props: NodeProps) {
  const data = props.data as WorkflowNode['data'];
  const hasRef = !!(data.config?.workflow_id);
  const hasInline = !!(data.config?.inline_definition);

  return (
    <BaseNode
      node={props}
      icon={<Layers className="h-4 w-4 text-indigo-600" />}
      color="border-indigo-300"
      bgColor="bg-indigo-50 dark:bg-indigo-950"
    >
      <div className="text-[10px] text-indigo-600 mt-1">
        {hasRef ? 'Referenced' : hasInline ? 'Inline' : 'Not configured'}
      </div>
    </BaseNode>
  );
}
