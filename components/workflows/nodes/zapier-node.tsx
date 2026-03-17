'use client';

import { type NodeProps } from '@xyflow/react';
import { Bolt } from 'lucide-react';
import { BaseNode } from './base-node';
import type { WorkflowNode } from '@/types/workflow';

export function ZapierNode(props: NodeProps) {
  const data = props.data as WorkflowNode['data'];
  const action = (data.config?.action as string) || '';
  const hasConnection = !!(data.config?.connection_id);

  return (
    <BaseNode
      node={props}
      icon={<Bolt className="h-4 w-4 text-orange-500" />}
      color="border-orange-400"
      bgColor="bg-orange-50 dark:bg-orange-950"
    >
      <div className="text-[10px] mt-1">
        {hasConnection ? (
          <span className="text-orange-600">{action || 'Connected'}</span>
        ) : (
          <span className="text-muted-foreground">Not connected</span>
        )}
      </div>
    </BaseNode>
  );
}
