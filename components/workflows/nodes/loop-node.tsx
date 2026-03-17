'use client';

import { type NodeProps } from '@xyflow/react';
import { Repeat } from 'lucide-react';
import { BaseNode } from './base-node';
import type { WorkflowNode } from '@/types/workflow';

export function LoopNode(props: NodeProps) {
  const data = props.data as WorkflowNode['data'];
  const collectionPath = (data.config?.collection_path as string) || '';

  return (
    <BaseNode
      node={props}
      icon={<Repeat className="h-4 w-4 text-cyan-600" />}
      color="border-cyan-300"
      bgColor="bg-cyan-50 dark:bg-cyan-950"
    >
      {collectionPath && (
        <div className="text-[10px] text-cyan-600 mt-1 truncate">over {collectionPath}</div>
      )}
    </BaseNode>
  );
}
