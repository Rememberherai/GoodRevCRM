'use client';

import type { SpacerBlock as SpacerBlockType } from '@/types/email-builder';

interface SpacerBlockEditorProps {
  block: SpacerBlockType;
  isSelected: boolean;
}

export function SpacerBlockEditor({ block, isSelected }: SpacerBlockEditorProps) {
  return (
    <div
      className="relative"
      style={{ height: block.height }}
    >
      {isSelected && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
          {block.height}px
        </div>
      )}
    </div>
  );
}
