'use client';

import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { useEmailBuilderStore } from '@/stores/email-builder';
import { BlockWrapper } from './block-wrapper';
import { BlockRenderer } from './block-renderer';
import { BlockErrorBoundary } from './block-error-boundary';
import type { BuilderVariable } from '@/lib/email-builder/variables';

interface CanvasProps {
  variables?: BuilderVariable[];
}

export function Canvas({ variables }: CanvasProps) {
  const blocks = useEmailBuilderStore((s) => s.design.blocks);
  const selectedBlockId = useEmailBuilderStore((s) => s.selectedBlockId);
  const contentWidth = useEmailBuilderStore((s) => s.design.globalStyles.contentWidth);
  const selectBlock = useEmailBuilderStore((s) => s.selectBlock);
  const removeBlock = useEmailBuilderStore((s) => s.removeBlock);
  const duplicateBlock = useEmailBuilderStore((s) => s.duplicateBlock);
  const updateBlock = useEmailBuilderStore((s) => s.updateBlock);
  const updateBlockDebounced = useEmailBuilderStore((s) => s.updateBlockDebounced);

  const { setNodeRef } = useDroppable({ id: 'canvas-droppable' });

  const blockIds = blocks.map((b) => b.id);

  return (
    <div
      className="flex-1 overflow-auto bg-muted/30 p-6"
      onClick={() => selectBlock(null)}
    >
      <div
        ref={setNodeRef}
        className="mx-auto bg-white shadow-sm rounded-sm min-h-[400px] pl-10 pr-2 py-4"
        style={{ maxWidth: contentWidth + 48 }}
      >
        {blocks.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
            Drag blocks from the left panel or click to add
          </div>
        ) : (
          <SortableContext items={blockIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-1">
              {blocks.map((block) => (
                <BlockErrorBoundary
                  key={block.id}
                  blockId={block.id}
                  onRemove={removeBlock}
                >
                  <BlockWrapper
                    blockId={block.id}
                    isSelected={selectedBlockId === block.id}
                    onSelect={() => selectBlock(block.id)}
                    onDuplicate={() => duplicateBlock(block.id)}
                    onRemove={() => removeBlock(block.id)}
                  >
                    <BlockRenderer
                      block={block}
                      isSelected={selectedBlockId === block.id}
                      onUpdate={(patch) => updateBlock(block.id, patch)}
                      onUpdateDebounced={(patch) => updateBlockDebounced(block.id, patch)}
                      variables={variables}
                    />
                  </BlockWrapper>
                </BlockErrorBoundary>
              ))}
            </div>
          </SortableContext>
        )}
      </div>
    </div>
  );
}
