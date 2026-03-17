'use client';

import {
  Play,
  Square,
  GitBranch,
  GitFork,
  Clock,
  Repeat,
  Zap,
  Brain,
  Layers,
  Wrench,
  Bolt,
  Globe,
} from 'lucide-react';
import { NODE_PALETTE, NODE_PALETTE_CATEGORIES, type WorkflowNodeType, type NodePaletteCategory } from '@/types/workflow';

const iconMap: Record<string, React.ElementType> = {
  Play,
  Square,
  GitBranch,
  GitFork,
  Clock,
  Repeat,
  Zap,
  Brain,
  Layers,
  Wrench,
  Bolt,
  Globe,
};

const colorMap: Record<string, string> = {
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  red: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  cyan: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  violet: 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300',
  indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300',
  slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  teal: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300',
};

export function WorkflowNodePalette() {
  const categories = Object.keys(NODE_PALETTE_CATEGORIES) as NodePaletteCategory[];

  function onDragStart(event: React.DragEvent, nodeType: WorkflowNodeType) {
    event.dataTransfer.setData('application/workflow-node-type', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  }

  return (
    <div className="p-3 space-y-4">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
        Nodes
      </h3>

      {categories.map((category) => {
        const items = NODE_PALETTE.filter((item) => item.category === category);
        return (
          <div key={category}>
            <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-1 mb-2">
              {NODE_PALETTE_CATEGORIES[category]}
            </h4>
            <div className="space-y-1">
              {items.map((item) => {
                const Icon = iconMap[item.icon] || Zap;
                return (
                  <div
                    key={item.type}
                    draggable
                    onDragStart={(e) => onDragStart(e, item.type)}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-grab active:cursor-grabbing hover:bg-muted transition-colors"
                    title={item.description}
                  >
                    <div className={`w-6 h-6 rounded flex items-center justify-center ${colorMap[item.color] || colorMap.slate}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-sm">{item.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
