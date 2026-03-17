'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Square } from 'lucide-react';

export function EndNode(props: NodeProps) {
  return (
    <div className={`flex flex-col items-center ${props.selected ? 'ring-2 ring-primary ring-offset-2 rounded-full' : ''}`}>
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-red-500 !border-2 !border-background"
      />
      <div className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center shadow-md">
        <Square className="h-5 w-5 text-white" />
      </div>
      <span className="text-xs font-medium mt-1">End</span>
    </div>
  );
}
