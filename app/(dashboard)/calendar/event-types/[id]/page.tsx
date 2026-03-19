'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
import type { EventType, LocationType } from '@/types/calendar';

export default function EditEventTypePage() {
  const params = useParams();
  const router = useRouter();
  const [eventType, setEventType] = useState<EventType | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/calendar/event-types/${params.id}`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setEventType(data.event_type);
        }
      } catch {
        // Silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [params.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventType) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/calendar/event-types/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: eventType.title,
          slug: eventType.slug,
          description: eventType.description,
          duration_minutes: eventType.duration_minutes,
          color: eventType.color,
          is_active: eventType.is_active,
          location_type: eventType.location_type,
          location_value: eventType.location_value,
          buffer_before_minutes: eventType.buffer_before_minutes,
          buffer_after_minutes: eventType.buffer_after_minutes,
          min_notice_hours: eventType.min_notice_hours,
          max_days_in_advance: eventType.max_days_in_advance,
          requires_confirmation: eventType.requires_confirmation,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.toString() || 'Failed to update');
        return;
      }

      router.push('/calendar/event-types');
    } catch {
      setError('An error occurred');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6 text-muted-foreground">Loading...</div>;
  if (!eventType) return <div className="p-6 text-muted-foreground">Event type not found</div>;

  const update = (partial: Partial<EventType>) =>
    setEventType((et) => (et ? { ...et, ...partial } : et));

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Edit Event Type</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <Switch
                checked={eventType.is_active ?? true}
                onCheckedChange={(checked) => update({ is_active: checked })}
              />
              <Label>{eventType.is_active !== false ? 'Active' : 'Inactive'}</Label>
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={eventType.title}
                onChange={(e) => update({ title: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>URL Slug</Label>
              <Input
                value={eventType.slug}
                onChange={(e) => update({ slug: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={eventType.description || ''}
                onChange={(e) => update({ description: e.target.value || null })}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Duration (min)</Label>
                <Input
                  type="number"
                  min={5}
                  max={480}
                  value={eventType.duration_minutes}
                  onChange={(e) =>
                    update({ duration_minutes: parseInt(e.target.value) || 30 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <Input
                  type="color"
                  value={eventType.color ?? '#3b82f6'}
                  onChange={(e) => update({ color: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Location</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select
              value={eventType.location_type}
              onValueChange={(v) => update({ location_type: v as LocationType })}
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
            {(eventType.location_type === 'in_person' || eventType.location_type === 'custom') && (
              <Input
                value={eventType.location_value || ''}
                onChange={(e) => update({ location_value: e.target.value || null })}
                placeholder="Location details"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scheduling</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Buffer Before (min)</Label>
                <Input
                  type="number"
                  min={0}
                  value={eventType.buffer_before_minutes ?? 0}
                  onChange={(e) =>
                    update({ buffer_before_minutes: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Buffer After (min)</Label>
                <Input
                  type="number"
                  min={0}
                  value={eventType.buffer_after_minutes ?? 0}
                  onChange={(e) =>
                    update({ buffer_after_minutes: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Min Notice (hours)</Label>
                <Input
                  type="number"
                  min={0}
                  value={eventType.min_notice_hours ?? 24}
                  onChange={(e) =>
                    update({ min_notice_hours: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Max Days Advance</Label>
                <Input
                  type="number"
                  min={1}
                  value={eventType.max_days_in_advance ?? 60}
                  onChange={(e) =>
                    update({ max_days_in_advance: parseInt(e.target.value) || 60 })
                  }
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={eventType.requires_confirmation ?? false}
                onCheckedChange={(checked) => update({ requires_confirmation: checked })}
              />
              <Label>Require host confirmation</Label>
            </div>
          </CardContent>
        </Card>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push('/calendar/event-types')}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
