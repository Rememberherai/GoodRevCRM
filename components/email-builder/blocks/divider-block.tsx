'use client';

import type { DividerBlock as DividerBlockType } from '@/types/email-builder';

interface DividerBlockEditorProps {
  block: DividerBlockType;
  isSelected?: boolean;
}

export function DividerBlockEditor({ block }: DividerBlockEditorProps) {
  return (
    <hr
      style={{
        border: 'none',
        borderTop: `${block.thickness}px ${block.style} ${block.color}`,
        margin: 0,
      }}
    />
  );
}
