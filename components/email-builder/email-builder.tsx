'use client';

import { useCallback, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Type, ImageIcon, MousePointerClick, Minus, ArrowUpDown } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEmailBuilderStore } from '@/stores/email-builder';
import { createDefaultBlock } from '@/lib/email-builder/default-blocks';
import { Palette } from './palette';
import { Canvas } from './canvas';
import { PropertyPanel } from './property-panel';
import { GlobalStylesPanel } from './global-styles-panel';
import { PreviewPanel } from './preview-panel';
import type { EmailDesign, BlockType } from '@/types/email-builder';
import type { BuilderVariable } from '@/lib/email-builder/variables';

const BLOCK_ICONS: Record<string, React.ElementType> = {
  text: Type,
  image: ImageIcon,
  button: MousePointerClick,
  divider: Minus,
  spacer: ArrowUpDown,
};

interface EmailBuilderProps {
  initialDesign?: EmailDesign;
  variables?: BuilderVariable[];
  showPreview?: boolean;
  /** Project slug — needed for image uploads */
  slug?: string;
}

export function EmailBuilder({ initialDesign, variables, showPreview = true, slug }: EmailBuilderProps) {
  const loadDesign = useEmailBuilderStore((s) => s.loadDesign);
  const addBlock = useEmailBuilderStore((s) => s.addBlock);
  const moveBlock = useEmailBuilderStore((s) => s.moveBlock);
  const setActiveBlock = useEmailBuilderStore((s) => s.setActiveBlock);
  const activeBlockId = useEmailBuilderStore((s) => s.activeBlockId);
  const dragSource = useEmailBuilderStore((s) => s.dragSource);
  const undo = useEmailBuilderStore((s) => s.undo);
  const redo = useEmailBuilderStore((s) => s.redo);
  const sidePanel = useEmailBuilderStore((s) => s.sidePanel);
  const setSidePanel = useEmailBuilderStore((s) => s.setSidePanel);
  const blocks = useEmailBuilderStore((s) => s.design.blocks);

  // Load initial design
  useEffect(() => {
    if (initialDesign) {
      loadDesign(initialDesign);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard shortcuts: Ctrl+Z / Ctrl+Y
  // Skip when focus is inside a TipTap editor — TipTap handles its own undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('.ProseMirror')) return;

      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event;
      const data = active.data.current;
      if (data?.source === 'palette') {
        setActiveBlock(String(active.id), 'palette');
      } else {
        setActiveBlock(String(active.id), 'canvas');
      }
    },
    [setActiveBlock]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveBlock(null, null);

      if (!over) return;

      const data = active.data.current;

      if (data?.source === 'palette') {
        // New block from palette
        const blockType = data.type as BlockType;
        const newBlock = createDefaultBlock(blockType);

        // Determine insertion index
        const overIndex = blocks.findIndex((b) => b.id === over.id);
        const insertAt = overIndex >= 0 ? overIndex : blocks.length;
        addBlock(newBlock, insertAt);
      } else {
        // Reorder within canvas
        const oldIndex = blocks.findIndex((b) => b.id === active.id);
        const newIndex = blocks.findIndex((b) => b.id === over.id);
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          moveBlock(oldIndex, newIndex);
        }
      }
    },
    [blocks, addBlock, moveBlock, setActiveBlock]
  );

  // Drag overlay content
  const overlayContent = (() => {
    if (!activeBlockId) return null;
    if (dragSource === 'palette') {
      const type = String(activeBlockId).replace('palette-', '') as BlockType;
      const Icon = BLOCK_ICONS[type] || Type;
      return (
        <div className="flex items-center gap-2 rounded border bg-background px-3 py-2 shadow-lg">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm capitalize">{type}</span>
        </div>
      );
    }
    // Canvas block being dragged — show a simple placeholder
    const draggedBlock = blocks.find((b) => b.id === activeBlockId);
    if (!draggedBlock) return null;
    const Icon = BLOCK_ICONS[draggedBlock.type] || Type;
    return (
      <div className="flex items-center gap-2 rounded border bg-background px-3 py-2 shadow-lg opacity-80">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm capitalize">{draggedBlock.type} block</span>
      </div>
    );
  })();

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full min-h-[500px] border rounded-lg overflow-hidden bg-background">
        {/* Left panel: palette + global styles */}
        <div className="w-56 border-r flex flex-col shrink-0">
          <Tabs value={sidePanel} onValueChange={(v) => setSidePanel(v as 'blocks' | 'styles')}>
            <TabsList className="w-full rounded-none border-b h-9">
              <TabsTrigger value="blocks" className="flex-1 text-xs">
                Blocks
              </TabsTrigger>
              <TabsTrigger value="styles" className="flex-1 text-xs">
                Styles
              </TabsTrigger>
            </TabsList>
            <TabsContent value="blocks" className="mt-0 p-3">
              <Palette />
            </TabsContent>
            <TabsContent value="styles" className="mt-0">
              <GlobalStylesPanel />
            </TabsContent>
          </Tabs>
        </div>

        {/* Center: canvas */}
        <Canvas variables={variables} />

        {/* Right panel: property editor or preview */}
        <div className="w-64 border-l flex flex-col shrink-0">
          {showPreview ? (
            <Tabs defaultValue="properties">
              <TabsList className="w-full rounded-none border-b h-9">
                <TabsTrigger value="properties" className="flex-1 text-xs">
                  Properties
                </TabsTrigger>
                <TabsTrigger value="preview" className="flex-1 text-xs">
                  Preview
                </TabsTrigger>
              </TabsList>
              <TabsContent value="properties" className="mt-0">
                <PropertyPanel slug={slug} />
              </TabsContent>
              <TabsContent value="preview" className="mt-0 h-[calc(100%-36px)]">
                <PreviewPanel />
              </TabsContent>
            </Tabs>
          ) : (
            <PropertyPanel slug={slug} />
          )}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>{overlayContent}</DragOverlay>
    </DndContext>
  );
}
