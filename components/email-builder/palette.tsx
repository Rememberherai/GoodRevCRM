'use client';

import { useDraggable } from '@dnd-kit/core';
import { Type, ImageIcon, MousePointerClick, Minus, ArrowUpDown } from 'lucide-react';
import type { BlockType } from '@/types/email-builder';

const BLOCK_ITEMS: { type: BlockType; label: string; icon: React.ElementType }[] = [
  { type: 'text', label: 'Text', icon: Type },
  { type: 'image', label: 'Image', icon: ImageIcon },
  { type: 'button', label: 'Button', icon: MousePointerClick },
  { type: 'divider', label: 'Divider', icon: Minus },
  { type: 'spacer', label: 'Spacer', icon: ArrowUpDown },
];

interface PaletteItemProps {
  type: BlockType;
  label: string;
  icon: React.ElementType;
}

function PaletteItem({ type, label, icon: Icon }: PaletteItemProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${type}`,
    data: { source: 'palette', type },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex flex-col items-center gap-1 rounded-md border border-border p-2.5 cursor-grab hover:bg-muted/50 transition-colors select-none ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <Icon className="h-5 w-5 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export function Palette() {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
        Blocks
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {BLOCK_ITEMS.map((item) => (
          <PaletteItem key={item.type} {...item} />
        ))}
      </div>
    </div>
  );
}
