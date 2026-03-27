'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Copy, GripVertical, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { getWidgetMeta } from '@/lib/community/public-dashboard-widget-meta';

const BORDER_COLOR_CLASSES: Record<string, string> = {
  blue: 'border-l-blue-500',
  emerald: 'border-l-emerald-500',
  violet: 'border-l-violet-500',
  amber: 'border-l-amber-500',
  rose: 'border-l-rose-500',
  slate: 'border-l-slate-400',
  teal: 'border-l-teal-500',
};

export function WidgetConfigWrapper({
  title,
  widgetType,
  children,
  onDelete,
  onDuplicate,
  dragHandleProps,
}: {
  title: string;
  widgetType?: string;
  children: React.ReactNode;
  onDelete: () => void;
  onDuplicate?: () => void;
  dragHandleProps?: {
    listeners?: Record<string, unknown>;
    attributes?: Record<string, unknown>;
  };
}) {
  const [open, setOpen] = useState(true);
  const meta = widgetType ? getWidgetMeta(widgetType) : null;
  const Icon = meta?.icon;
  const borderClass = meta ? BORDER_COLOR_CLASSES[meta.color] ?? '' : '';

  return (
    <Card className={`border-l-4 ${borderClass}`}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="flex flex-row items-center justify-between gap-2 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
              aria-label="Drag to reorder"
              {...(dragHandleProps?.listeners as React.HTMLAttributes<HTMLButtonElement>)}
              {...(dragHandleProps?.attributes as React.HTMLAttributes<HTMLButtonElement>)}
            >
              <GripVertical className="h-4 w-4" />
            </button>
            <CollapsibleTrigger asChild>
              <button type="button" className="flex items-center gap-2 min-w-0">
                {open ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />}
                <CardTitle className="text-sm truncate">{title || (meta?.label ?? 'Widget')}</CardTitle>
              </button>
            </CollapsibleTrigger>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {onDuplicate && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDuplicate} aria-label="Duplicate widget">
                <Copy className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDelete} aria-label="Delete widget">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0">{children}</CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
