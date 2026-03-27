'use client';

import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { MetricWidgetConfig } from '@/components/community/public-dashboard/widgets/widget-config-metric';
import { ChartWidgetConfig } from '@/components/community/public-dashboard/widgets/widget-config-chart';
import { MapWidgetConfig } from '@/components/community/public-dashboard/widgets/widget-config-map';
import { TextWidgetConfig } from '@/components/community/public-dashboard/widgets/widget-config-text';
import { WidgetGallery } from '@/components/community/public-dashboard/widget-gallery';
import { ExternalLink } from 'lucide-react';
import { HeroImageUpload } from '@/components/community/public-dashboard/hero-image-upload';
import { getWidgetMeta } from '@/lib/community/public-dashboard-widget-meta';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'dashboard';
}

type WidgetRecord = {
  id: string;
  type: string;
  title?: string;
  config?: Record<string, unknown>;
};

export interface EditablePublicDashboardConfig {
  id?: string;
  title: string;
  description: string | null;
  slug: string;
  status: 'draft' | 'preview' | 'published' | 'archived';
  access_type: 'public' | 'password' | 'signed_link';
  password?: string;
  data_freshness: 'live' | 'snapshot';
  min_count_threshold: number;
  geo_granularity: 'zip' | 'neighborhood';
  hero_image_url: string | null;
  widgets: WidgetRecord[];
}

function createWidget(type: string): WidgetRecord {
  return {
    id: crypto.randomUUID(),
    type,
    title: '',
    config: {},
  };
}

function SortableWidgetItem({
  widget,
  children,
}: {
  widget: WidgetRecord;
  children: (props: { listeners: Record<string, unknown>; attributes: Record<string, unknown> }) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: widget.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {children({ listeners: (listeners ?? {}) as unknown as Record<string, unknown>, attributes: (attributes ?? {}) as unknown as Record<string, unknown> })}
    </div>
  );
}

export function ConfigEditor({
  config,
  onChange,
  onSave,
  saving,
  isDirty,
  projectSlug,
}: {
  config: EditablePublicDashboardConfig | null;
  onChange: (config: EditablePublicDashboardConfig) => void;
  onSave: () => void;
  saving?: boolean;
  isDirty?: boolean;
  projectSlug?: string;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  if (!config) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Public Dashboard</CardTitle>
          <CardDescription>Select a config to edit, or create a new dashboard.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id || !config) return;
    const oldIndex = config.widgets.findIndex((w) => w.id === active.id);
    const newIndex = config.widgets.findIndex((w) => w.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onChange({ ...config, widgets: arrayMove(config.widgets, oldIndex, newIndex) });
  }

  function handleAddWidget(type: string) {
    if (!config) return;
    onChange({ ...config, widgets: [...config.widgets, createWidget(type)] });
  }

  function handleDuplicate(index: number) {
    if (!config) return;
    const source = config.widgets[index];
    if (!source) return;
    const clone: WidgetRecord = {
      ...structuredClone(source),
      id: crypto.randomUUID(),
    };
    const widgets = [...config.widgets];
    widgets.splice(index + 1, 0, clone);
    onChange({ ...config, widgets });
  }

  const activeWidget = activeId ? config.widgets.find((w) => w.id === activeId) : null;
  const activeMeta = activeWidget ? getWidgetMeta(activeWidget.type) : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Dashboard Settings</CardTitle>
          <CardDescription>Branding, access control, and widget configuration.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label>Title</Label>
            <Input
              value={config.title}
              onChange={(event) => {
                const title = event.target.value;
                onChange({ ...config, title, slug: slugify(title) });
              }}
            />
            {config.slug && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ExternalLink className="h-3 w-3 shrink-0" />
                <span className="truncate">
                  /public/{projectSlug}/{config.slug}
                </span>
              </div>
            )}
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Description</Label>
            <Textarea value={config.description ?? ''} onChange={(event) => onChange({ ...config, description: event.target.value || null })} />
          </div>
          <div className="space-y-2">
            <Label>Access Type</Label>
            <Select value={config.access_type} onValueChange={(value: EditablePublicDashboardConfig['access_type']) => onChange({ ...config, access_type: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public</SelectItem>
                <SelectItem value="password">Password</SelectItem>
                <SelectItem value="signed_link">Signed Link</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Data Freshness</Label>
            <Select value={config.data_freshness} onValueChange={(value: EditablePublicDashboardConfig['data_freshness']) => onChange({ ...config, data_freshness: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="live">Live</SelectItem>
                <SelectItem value="snapshot">Snapshot</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {config.access_type === 'password' && (
            <div className="space-y-2">
              <Label>Password</Label>
              <Input value={config.password ?? ''} onChange={(event) => onChange({ ...config, password: event.target.value })} />
            </div>
          )}
          <div className="space-y-2">
            <Label>Min Count Threshold</Label>
            <Input
              type="number"
              min={3}
              value={String(config.min_count_threshold)}
              onChange={(event) => onChange({ ...config, min_count_threshold: Number(event.target.value || 5) })}
            />
          </div>
          <div className="space-y-2">
            <Label>Geo Granularity</Label>
            <Select value={config.geo_granularity} onValueChange={(value: EditablePublicDashboardConfig['geo_granularity']) => onChange({ ...config, geo_granularity: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="zip">ZIP</SelectItem>
                <SelectItem value="neighborhood">Neighborhood</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Hero Image</Label>
            {projectSlug ? (
              <HeroImageUpload
                projectSlug={projectSlug}
                currentUrl={config.hero_image_url}
                onUploaded={(url) => onChange({ ...config, hero_image_url: url })}
              />
            ) : (
              <Input value={config.hero_image_url ?? ''} onChange={(event) => onChange({ ...config, hero_image_url: event.target.value || null })} />
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              Widgets
              {config.widgets.length > 0 && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                  {config.widgets.length}
                </span>
              )}
            </CardTitle>
            <CardDescription>Add aggregate-only widgets to the public dashboard.</CardDescription>
          </div>
          <WidgetGallery onAdd={handleAddWidget} />
        </CardHeader>
        <CardContent className="space-y-3">
          {config.widgets.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
              No widgets yet. Click &ldquo;Add Widget&rdquo; to get started.
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={config.widgets.map((w) => w.id)} strategy={verticalListSortingStrategy}>
                {config.widgets.map((widget, index) => {
                  const onWidgetChange = (next: Record<string, unknown>) => {
                    const widgets = [...config.widgets];
                    widgets[index] = next as WidgetRecord;
                    onChange({ ...config, widgets });
                  };
                  const onDelete = () => {
                    onChange({ ...config, widgets: config.widgets.filter((current) => current.id !== widget.id) });
                  };
                  const onDuplicate = () => handleDuplicate(index);

                  return (
                    <SortableWidgetItem key={widget.id} widget={widget}>
                      {(dragProps) => {
                        const sharedProps = {
                          widget,
                          onChange: onWidgetChange,
                          onDelete,
                          onDuplicate,
                          dragHandleProps: dragProps,
                        };

                        if (widget.type === 'metric_card') {
                          return <MetricWidgetConfig {...sharedProps} />;
                        }
                        if (widget.type === 'bar_chart' || widget.type === 'radar_chart' || widget.type === 'program_summary' || widget.type === 'contribution_summary') {
                          return <ChartWidgetConfig {...sharedProps} widgetType={widget.type} label={`${widget.type.replace(/_/g, ' ')} widget`} />;
                        }
                        if (widget.type === 'map_heatmap') {
                          return <MapWidgetConfig {...sharedProps} />;
                        }
                        return <TextWidgetConfig {...sharedProps} />;
                      }}
                    </SortableWidgetItem>
                  );
                })}
              </SortableContext>
              <DragOverlay>
                {activeWidget && activeMeta && (
                  <div className="rounded-lg border bg-card p-3 shadow-lg flex items-center gap-2 opacity-90">
                    <activeMeta.icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{String(activeWidget.title || activeMeta.label)}</span>
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3">
        {isDirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
        <Button onClick={onSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Configuration'}
        </Button>
      </div>
    </div>
  );
}
