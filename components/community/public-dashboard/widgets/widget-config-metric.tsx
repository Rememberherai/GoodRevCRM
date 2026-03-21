'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { WidgetConfigWrapper } from './widget-config-wrapper';

export function MetricWidgetConfig({
  widget,
  onChange,
  onDelete,
}: {
  widget: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  onDelete: () => void;
}) {
  return (
    <WidgetConfigWrapper title="Metric Card Widget" onDelete={onDelete}>
      <div className="space-y-3">
        <div className="space-y-2">
          <Label>Title</Label>
          <Input value={String(widget.title ?? '')} onChange={(event) => onChange({ ...widget, title: event.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Min Count Threshold</Label>
          <Input
            type="number"
            min={3}
            value={String(widget.min_count_threshold ?? 5)}
            onChange={(event) => onChange({ ...widget, min_count_threshold: Number(event.target.value || 5) })}
          />
        </div>
      </div>
    </WidgetConfigWrapper>
  );
}
