'use client';

import type { EmailBlock } from '@/types/email-builder';
import type { BuilderVariable } from '@/lib/email-builder/variables';
import { TextBlockEditor } from './blocks/text-block';
import { ImageBlockEditor } from './blocks/image-block';
import { ButtonBlockEditor } from './blocks/button-block';
import { DividerBlockEditor } from './blocks/divider-block';
import { SpacerBlockEditor } from './blocks/spacer-block';

interface BlockRendererProps {
  block: EmailBlock;
  isSelected: boolean;
  onUpdate: (patch: Partial<EmailBlock>) => void;
  onUpdateDebounced: (patch: Partial<EmailBlock>) => void;
  variables?: BuilderVariable[];
}

export function BlockRenderer({
  block,
  isSelected,
  onUpdate,
  onUpdateDebounced,
  variables,
}: BlockRendererProps) {
  switch (block.type) {
    case 'text':
      return (
        <TextBlockEditor
          block={block}
          onUpdate={onUpdate}
          onUpdateDebounced={onUpdateDebounced}
          isSelected={isSelected}
          variables={variables}
        />
      );
    case 'image':
      return <ImageBlockEditor block={block} isSelected={isSelected} />;
    case 'button':
      return <ButtonBlockEditor block={block} isSelected={isSelected} />;
    case 'divider':
      return <DividerBlockEditor block={block} isSelected={isSelected} />;
    case 'spacer':
      return <SpacerBlockEditor block={block} isSelected={isSelected} />;
    default:
      return <div className="p-2 text-xs text-muted-foreground">Unknown block</div>;
  }
}
