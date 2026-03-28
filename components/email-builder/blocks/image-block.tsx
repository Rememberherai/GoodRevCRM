'use client';

import type { ImageBlock as ImageBlockType } from '@/types/email-builder';

interface ImageBlockEditorProps {
  block: ImageBlockType;
  isSelected?: boolean;
}

export function ImageBlockEditor({ block }: ImageBlockEditorProps) {
  if (!block.src) {
    return (
      <div
        className="flex items-center justify-center border-2 border-dashed border-muted-foreground/30 rounded bg-muted/20 text-muted-foreground text-sm"
        style={{ height: 200, maxWidth: block.width }}
      >
        Click to set image URL
      </div>
    );
  }

  return (
    <div
      style={{
        textAlign: block.align,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={block.src}
        alt={block.alt}
        style={{
          maxWidth: '100%',
          width: block.width,
          height: 'auto',
          display: 'inline-block',
        }}
      />
    </div>
  );
}
