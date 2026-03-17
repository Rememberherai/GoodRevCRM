'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Play } from 'lucide-react';

export function StartNode(props: NodeProps) {
  return (
    <div className={`flex flex-col items-center ${props.selected ? 'ring-2 ring-primary ring-offset-2 rounded-full' : ''}`}>
      <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center shadow-md">
        <Play className="h-5 w-5 text-white ml-0.5" />
      </div>
      <span className="text-xs font-medium mt-1">Start</span>
      <Handle
        type="source"
        position={Position.Bottom}
        id="default"
        className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-background"
      />
    </div>
  );
}
