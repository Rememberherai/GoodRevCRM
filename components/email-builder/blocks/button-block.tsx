'use client';

import type { ButtonBlock as ButtonBlockType } from '@/types/email-builder';

interface ButtonBlockEditorProps {
  block: ButtonBlockType;
  isSelected?: boolean;
}

export function ButtonBlockEditor({ block }: ButtonBlockEditorProps) {
  return (
    <div style={{ textAlign: block.align }}>
      <div
        style={{
          display: block.fullWidth ? 'block' : 'inline-block',
          padding: '12px 24px',
          backgroundColor: block.buttonColor,
          color: block.textColor,
          borderRadius: block.borderRadius,
          fontFamily: 'inherit',
          fontSize: 16,
          textAlign: 'center',
          textDecoration: 'none',
          cursor: 'default',
          width: block.fullWidth ? '100%' : undefined,
          boxSizing: 'border-box',
        }}
      >
        {block.text || 'Button'}
      </div>
    </div>
  );
}
