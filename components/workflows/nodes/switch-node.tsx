'use client';

import { type NodeProps } from '@xyflow/react';
import { GitFork } from 'lucide-react';
import { BaseNode } from './base-node';
import type { WorkflowNode } from '@/types/workflow';

export function SwitchNode(props: NodeProps) {
  const data = props.data as WorkflowNode['data'];
  const cases = (data.config?.cases as Array<{ value: unknown; label: string }>) || [];
  const defaultLabel = (data.config?.default_label as string) || 'default';

  const caseLabels = new Set(cases.map((c) => c.label));
  const outputs = [
    ...cases.map((c) => ({ id: c.label, label: c.label })),
    // Only add default handle if no case already uses the same label
    ...(caseLabels.has(defaultLabel) ? [] : [{ id: defaultLabel, label: defaultLabel }]),
  ];

  return (
    <BaseNode
      node={props}
      icon={<GitFork className="h-4 w-4 text-amber-600" />}
      color="border-amber-300"
      bgColor="bg-amber-50 dark:bg-amber-950"
      handles={{
        inputs: [{}],
        outputs: outputs.length > 0 ? outputs : [{ id: 'default', label: 'default' }],
      }}
    >
      <div className="text-[10px] text-amber-600 mt-1">
        {cases.length} case{cases.length !== 1 ? 's' : ''} + default
      </div>
    </BaseNode>
  );
}
