'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCalendarContext } from '../../calendar-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { LOCATION_TYPE_LABELS } from '@/types/calendar';
import type { LocationType } from '@/types/calendar';

export default function NewEventTypePage() {
  const router = useRouter();
  const { selectedProjectId } = useCalendarContext();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: '',
    slug: '',
    description: '',
    duration_minutes: 30,
    location_type: 'video' as LocationType,
    location_value: '',
    buffer_before_minutes: 0,
    buffer_after_minutes: 0,
    min_notice_hours: 24,
    max_days_in_advance: 60,
    requires_confirmation: false,
    color: '#3b82f6',
  });

  const autoSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (!selectedProjectId) {
        setError('No project selected. Please select a project first.');
        setSaving(false);
        return;
      }

      const res = await fetch('/api/calendar/event-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          project_id: selectedProjectId,
          slug: form.slug || autoSlug(form.title),
          description: form.description || null,
          location_value: form.location_value || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.toString() || 'Failed to create event type');
        return;
      }

      router.push('/calendar/event-types');
    } catch {
      setError('An error occurred');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Create Event Type</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => {
                  setForm((f) => ({
                    ...f,
                    title: e.target.value,
                    slug: f.slug || autoSlug(e.target.value),
                  }));
                }}
                placeholder="30 Minute Meeting"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">URL Slug</Label>
              <Input
                id="slug"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                placeholder="30-minute-meeting"
              />
              <p className="text-xs text-muted-foreground">
                Your booking link: /book/your-name/{form.slug || 'slug'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="A brief description of this meeting type..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="duration">Duration (min)</Label>
                <Input
                  id="duration"
                  type="number"
                  min={5}
                  max={480}
                  value={form.duration_minutes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, duration_minutes: parseInt(e.target.value) || 30 }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Select
                  value={form.location_type}
                  onValueChange={(v) => setForm((f) => ({ ...f, location_type: v as LocationType }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(LOCATION_TYPE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="color">Color</Label>
                <Input
                  id="color"
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  className="h-9"
                />
              </div>
            </div>

            {(form.location_type === 'in_person' || form.location_type === 'custom') && (
              <div className="space-y-2">
                <Label htmlFor="location_value">Location Details</Label>
                <Input
                  id="location_value"
                  value={form.location_value}
                  onChange={(e) => setForm((f) => ({ ...f, location_value: e.target.value }))}
                  placeholder="Address or meeting details"
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scheduling Rules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Buffer Before</Label>
                <Input
                  type="number"
                  min={0}
                  max={120}
                  value={form.buffer_before_minutes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, buffer_before_minutes: parseInt(e.target.value) || 0 }))
                  }
                  placeholder="min"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Buffer After</Label>
                <Input
                  type="number"
                  min={0}
                  max={120}
                  value={form.buffer_after_minutes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, buffer_after_minutes: parseInt(e.target.value) || 0 }))
                  }
                  placeholder="min"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Min Notice (hrs)</Label>
                <Input
                  type="number"
                  min={0}
                  max={720}
                  value={form.min_notice_hours}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, min_notice_hours: parseInt(e.target.value) || 0 }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Max Days Out</Label>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={form.max_days_in_advance}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, max_days_in_advance: parseInt(e.target.value) || 60 }))
                  }
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.requires_confirmation}
                onCheckedChange={(checked) =>
                  setForm((f) => ({ ...f, requires_confirmation: checked }))
                }
              />
              <Label className="text-sm">Require host confirmation</Label>
            </div>
          </CardContent>
        </Card>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? 'Creating...' : 'Create Event Type'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/calendar/event-types')}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
