'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { WidgetConfigWrapper } from './widget-config-wrapper';

export function TextWidgetConfig({
  widget,
  onChange,
  onDelete,
  onDuplicate,
  dragHandleProps,
}: {
  widget: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  onDelete: () => void;
  onDuplicate?: () => void;
  dragHandleProps?: { listeners?: Record<string, unknown>; attributes?: Record<string, unknown> };
}) {
  const config = (widget.config ?? {}) as Record<string, unknown>;

  return (
    <WidgetConfigWrapper title={String(widget.title || '')} widgetType="text_block" onDelete={onDelete} onDuplicate={onDuplicate} dragHandleProps={dragHandleProps}>
      <div className="space-y-3">
        <div className="space-y-2">
          <Label>Title</Label>
          <Input value={String(widget.title ?? '')} onChange={(event) => onChange({ ...widget, title: event.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Body</Label>
          <Textarea
            rows={4}
            value={String(config.text ?? '')}
            onChange={(event) => onChange({ ...widget, config: { ...config, text: event.target.value } })}
          />
        </div>
      </div>
    </WidgetConfigWrapper>
  );
}
