'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { WIDGET_TYPE_META } from '@/lib/community/public-dashboard-widget-meta';

const COLOR_CLASSES: Record<string, string> = {
  blue: 'border-l-blue-500',
  emerald: 'border-l-emerald-500',
  violet: 'border-l-violet-500',
  amber: 'border-l-amber-500',
  rose: 'border-l-rose-500',
  slate: 'border-l-slate-400',
  teal: 'border-l-teal-500',
};

export function WidgetGallery({ onAdd }: { onAdd: (type: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add Widget
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Widget</DialogTitle>
          <DialogDescription>Choose a widget type to add to your dashboard.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {Object.entries(WIDGET_TYPE_META).map(([type, meta]) => {
            const Icon = meta.icon;
            const borderClass = COLOR_CLASSES[meta.color] ?? 'border-l-slate-400';

            return (
              <button
                key={type}
                disabled={meta.disabled}
                onClick={() => {
                  if (!meta.disabled) {
                    onAdd(type);
                    setOpen(false);
                  }
                }}
                className={`flex items-start gap-3 rounded-lg border border-l-4 p-4 text-left transition-colors ${borderClass} ${
                  meta.disabled
                    ? 'cursor-not-allowed opacity-50'
                    : 'hover:bg-accent'
                }`}
              >
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{meta.label}</span>
                    {meta.disabled && (
                      <Badge variant="secondary" className="text-xs">Coming soon</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
