'use client';

import { type NodeProps } from '@xyflow/react';
import { GitBranch } from 'lucide-react';
import { BaseNode } from './base-node';
import type { WorkflowNode } from '@/types/workflow';

export function ConditionNode(props: NodeProps) {
  const data = props.data as WorkflowNode['data'];
  const field = (data.config?.field as string) || '';

  return (
    <BaseNode
      node={props}
      icon={<GitBranch className="h-4 w-4 text-amber-600" />}
      color="border-amber-300"
      bgColor="bg-amber-50 dark:bg-amber-950"
      handles={{
        inputs: [{}],
        outputs: [
          { id: 'true', label: 'True' },
          { id: 'false', label: 'False' },
        ],
      }}
    >
      {field && (
        <div className="text-[10px] text-amber-600 mt-1 truncate">if {field}</div>
      )}
    </BaseNode>
  );
}
