'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import type { WorkflowNode } from '@/types/workflow';

interface BaseNodeProps {
  node: NodeProps;
  icon: React.ReactNode;
  color: string; // Tailwind border color class
  bgColor: string; // Tailwind bg color class
  handles?: {
    inputs?: Array<{ id?: string; position?: Position }>;
    outputs?: Array<{ id: string; label?: string; position?: Position }>;
  };
  children?: React.ReactNode;
}

export function BaseNode({ node, icon, color, bgColor, handles, children }: BaseNodeProps) {
  const data = node.data as WorkflowNode['data'];
  const inputs = handles?.inputs || [{}];
  const outputs = handles?.outputs || [{ id: 'default' }];

  return (
    <div
      className={cn(
        'rounded-lg border-2 shadow-sm min-w-[160px] max-w-[240px]',
        color,
        node.selected ? 'ring-2 ring-primary ring-offset-2' : ''
      )}
    >
      {/* Input handles */}
      {inputs.map((input, i) => (
        <Handle
          key={`in-${i}`}
          type="target"
          position={input.position || Position.Top}
          id={input.id}
          className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-background"
        />
      ))}

      {/* Node content */}
      <div className={cn('px-3 py-2', bgColor)}>
        <div className="flex items-center gap-2">
          <div className="flex-shrink-0">{icon}</div>
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{data.label}</div>
            {data.description && (
              <div className="text-[10px] text-muted-foreground truncate">{data.description}</div>
            )}
          </div>
        </div>
        {children}
      </div>

      {/* Output handles */}
      {outputs.map((output, i) => {
        const totalOutputs = outputs.length;
        const offset = totalOutputs > 1
          ? `${((i + 1) / (totalOutputs + 1)) * 100}%`
          : '50%';

        return (
          <Handle
            key={`out-${output.id}`}
            type="source"
            position={output.position || Position.Bottom}
            id={output.id}
            className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-background"
            style={totalOutputs > 1 ? { left: offset } : undefined}
          >
            {output.label && (
              <span className="absolute top-3 text-[9px] text-muted-foreground whitespace-nowrap -translate-x-1/2 left-1/2">
                {output.label}
              </span>
            )}
          </Handle>
        );
      })}
    </div>
  );
}
