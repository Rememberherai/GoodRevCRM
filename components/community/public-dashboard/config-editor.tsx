'use client';

import { Plus } from 'lucide-react';
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

type WidgetRecord = {
  id: string;
  type: string;
  title?: string;
  min_count_threshold?: number;
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
    min_count_threshold: 5,
    config: {},
  };
}

export function ConfigEditor({
  config,
  onChange,
  onSave,
}: {
  config: EditablePublicDashboardConfig | null;
  onChange: (config: EditablePublicDashboardConfig) => void;
  onSave: () => void;
}) {
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Dashboard Settings</CardTitle>
          <CardDescription>Branding, access control, and widget configuration.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={config.title} onChange={(event) => onChange({ ...config, title: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Slug</Label>
            <Input value={config.slug} onChange={(event) => onChange({ ...config, slug: event.target.value })} />
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
            <Label>Hero Image URL</Label>
            <Input value={config.hero_image_url ?? ''} onChange={(event) => onChange({ ...config, hero_image_url: event.target.value || null })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Widgets</CardTitle>
            <CardDescription>Add aggregate-only widgets to the public dashboard.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {['metric_card', 'bar_chart', 'radar_chart', 'program_summary', 'contribution_summary', 'text_block', 'map_heatmap'].map((type) => (
              <Button key={type} variant="outline" size="sm" onClick={() => onChange({ ...config, widgets: [...config.widgets, createWidget(type)] })}>
                <Plus className="mr-2 h-4 w-4" />
                {type.replace(/_/g, ' ')}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {config.widgets.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              No widgets yet. Add a metric, chart, or text block.
            </div>
          ) : (
            config.widgets.map((widget, index) => {
              const onWidgetChange = (next: Record<string, unknown>) => {
                const widgets = [...config.widgets];
                widgets[index] = next as WidgetRecord;
                onChange({ ...config, widgets });
              };
              const onDelete = () => {
                onChange({ ...config, widgets: config.widgets.filter((current) => current.id !== widget.id) });
              };

              if (widget.type === 'metric_card') {
                return <MetricWidgetConfig key={widget.id} widget={widget} onChange={onWidgetChange} onDelete={onDelete} />;
              }
              if (widget.type === 'bar_chart' || widget.type === 'radar_chart' || widget.type === 'program_summary' || widget.type === 'contribution_summary') {
                return <ChartWidgetConfig key={widget.id} widget={widget} label={`${widget.type.replace(/_/g, ' ')} widget`} onChange={onWidgetChange} onDelete={onDelete} />;
              }
              if (widget.type === 'map_heatmap') {
                return <MapWidgetConfig key={widget.id} widget={widget} onChange={onWidgetChange} onDelete={onDelete} />;
              }
              return <TextWidgetConfig key={widget.id} widget={widget} onChange={onWidgetChange} onDelete={onDelete} />;
            })
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={onSave}>Save Configuration</Button>
      </div>
    </div>
  );
}
