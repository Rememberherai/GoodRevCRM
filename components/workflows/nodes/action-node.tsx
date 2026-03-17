'use client';

import { type NodeProps } from '@xyflow/react';
import { Zap } from 'lucide-react';
import { BaseNode } from './base-node';
import type { WorkflowNode } from '@/types/workflow';

export function ActionNode(props: NodeProps) {
  const data = props.data as WorkflowNode['data'];
  const actionType = (data.config?.action_type as string) || '';

  return (
    <BaseNode
      node={props}
      icon={<Zap className="h-4 w-4 text-blue-600" />}
      color="border-blue-300"
      bgColor="bg-blue-50 dark:bg-blue-950"
    >
      {actionType && (
        <div className="text-[10px] text-blue-600 mt-1">{actionType.replace(/_/g, ' ')}</div>
      )}
    </BaseNode>
  );
}
