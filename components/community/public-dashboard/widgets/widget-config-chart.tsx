'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { WidgetConfigWrapper } from './widget-config-wrapper';

export function ChartWidgetConfig({
  widget,
  widgetType,
  label: _label,
  onChange,
  onDelete,
  onDuplicate,
  dragHandleProps,
}: {
  widget: Record<string, unknown>;
  widgetType?: string;
  label: string;
  onChange: (next: Record<string, unknown>) => void;
  onDelete: () => void;
  onDuplicate?: () => void;
  dragHandleProps?: { listeners?: Record<string, unknown>; attributes?: Record<string, unknown> };
}) {
  return (
    <WidgetConfigWrapper title={String(widget.title || '')} widgetType={widgetType} onDelete={onDelete} onDuplicate={onDuplicate} dragHandleProps={dragHandleProps}>
      <div className="space-y-2">
        <Label>Title</Label>
        <Input value={String(widget.title ?? '')} onChange={(event) => onChange({ ...widget, title: event.target.value })} />
      </div>
    </WidgetConfigWrapper>
  );
}
