'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Copy, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { BlockId } from '@/types/email-builder';

interface BlockWrapperProps {
  blockId: BlockId;
  isSelected: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  children: React.ReactNode;
}

export function BlockWrapper({
  blockId,
  isSelected,
  onSelect,
  onDuplicate,
  onRemove,
  children,
}: BlockWrapperProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: blockId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative rounded border transition-colors',
        isDragging && 'opacity-50 z-50',
        isSelected ? 'border-primary ring-1 ring-primary/20' : 'border-transparent hover:border-border'
      )}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {/* Drag handle — only this triggers drag */}
      <div
        {...attributes}
        {...listeners}
        className={cn(
          'absolute -left-8 top-1/2 -translate-y-1/2 cursor-grab rounded p-0.5 transition-opacity',
          isSelected || isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        )}
        title="Drag to reorder"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Actions */}
      {isSelected && (
        <div className="absolute -right-1 -top-1 z-10 flex items-center gap-0.5 rounded bg-background shadow-sm border p-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
            title="Duplicate"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Block content */}
      <div className="overflow-hidden rounded">
        {children}
      </div>
    </div>
  );
}
