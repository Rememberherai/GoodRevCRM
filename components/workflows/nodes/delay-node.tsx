'use client';

import { type NodeProps } from '@xyflow/react';
import { Clock } from 'lucide-react';
import { BaseNode } from './base-node';
import type { WorkflowNode } from '@/types/workflow';

export function DelayNode(props: NodeProps) {
  const data = props.data as WorkflowNode['data'];
  const delayType = (data.config?.delay_type as string) || 'duration';
  const durationMs = (data.config?.duration_ms as number) || 0;

  function formatDuration(ms: number): string {
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
    return `${Math.round(ms / 3600000)}h`;
  }

  return (
    <BaseNode
      node={props}
      icon={<Clock className="h-4 w-4 text-orange-600" />}
      color="border-orange-300"
      bgColor="bg-orange-50 dark:bg-orange-950"
    >
      <div className="text-[10px] text-orange-600 mt-1">
        {delayType === 'duration' && durationMs > 0 ? `Wait ${formatDuration(durationMs)}` : delayType.replace(/_/g, ' ')}
      </div>
    </BaseNode>
  );
}
