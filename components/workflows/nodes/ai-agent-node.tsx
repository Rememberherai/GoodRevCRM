'use client';

import { type NodeProps } from '@xyflow/react';
import { Brain } from 'lucide-react';
import { BaseNode } from './base-node';
import type { WorkflowNode } from '@/types/workflow';

export function AiAgentNode(props: NodeProps) {
  const data = props.data as WorkflowNode['data'];
  const model = (data.config?.model as string) || '';

  return (
    <BaseNode
      node={props}
      icon={<Brain className="h-4 w-4 text-violet-600" />}
      color="border-violet-300"
      bgColor="bg-violet-50 dark:bg-violet-950"
    >
      {model && (
        <div className="text-[10px] text-violet-600 mt-1 truncate">{model.split('/').pop()}</div>
      )}
    </BaseNode>
  );
}
