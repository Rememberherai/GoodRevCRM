'use client';

import { type NodeProps } from '@xyflow/react';
import { Globe } from 'lucide-react';
import { BaseNode } from './base-node';
import { Badge } from '@/components/ui/badge';
import type { WorkflowNode } from '@/types/workflow';

export function WebhookNode(props: NodeProps) {
  const data = props.data as WorkflowNode['data'];
  const url = (data.config?.url as string) || '';
  const method = (data.config?.method as string) || 'POST';

  return (
    <BaseNode
      node={props}
      icon={<Globe className="h-4 w-4 text-teal-600" />}
      color="border-teal-300"
      bgColor="bg-teal-50 dark:bg-teal-950"
    >
      <div className="flex items-center gap-1 mt-1">
        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">{method}</Badge>
        {url && (
          <span className="text-[10px] text-teal-600 truncate max-w-[120px]">
            {url.replace(/^https?:\/\//, '')}
          </span>
        )}
      </div>
    </BaseNode>
  );
}
