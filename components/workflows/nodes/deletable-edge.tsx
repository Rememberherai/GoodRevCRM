'use client';

import { useState } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';
import { X } from 'lucide-react';
import { useWorkflowStore } from '@/stores/workflow-store';

export function DeletableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  style = {},
  markerEnd,
}: EdgeProps) {
  const [hovered, setHovered] = useState(false);
  const removeEdge = useWorkflowStore((s) => s.removeEdge);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      {/* Invisible wider path for hover detection */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: hovered ? 'var(--destructive)' : undefined,
        }}
      />
      <EdgeLabelRenderer>
        {/* Edge label */}
        {label && (
          <div
            className="absolute text-[10px] text-muted-foreground bg-background px-1 rounded pointer-events-none"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY - 12}px)`,
            }}
          >
            {label}
          </div>
        )}
        {/* Delete button */}
        {hovered && (
          <div
            className="absolute"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            <button
              className="w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm hover:bg-destructive/90"
              onClick={() => removeEdge(id)}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
}
