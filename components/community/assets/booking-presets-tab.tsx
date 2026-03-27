'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Clock,
  Plus,
  Pencil,
  Trash2,
  MapPin,
  Video,
  Phone,
  Loader2,
  CalendarClock,
} from 'lucide-react';

interface EventTypePreset {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  duration_minutes: number;
  color: string;
  is_active: boolean;
  location_type: string;
  location_value: string | null;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  min_notice_hours: number;
  max_days_in_advance: number;
  requires_confirmation: boolean;
  schedule_id: string | null;
  created_at: string;
}

interface PresetFormData {
  title: string;
  description: string;
  duration_minutes: number;
  color: string;
  location_type: string;
  location_value: string;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  min_notice_hours: number;
  max_days_in_advance: number;
  requires_confirmation: boolean;
}

const DEFAULT_FORM: PresetFormData = {
  title: '',
  description: '',
  duration_minutes: 60,
  color: '#3b82f6',
  location_type: 'in_person',
  location_value: '',
  buffer_before_minutes: 0,
  buffer_after_minutes: 0,
  min_notice_hours: 24,
  max_days_in_advance: 60,
  requires_confirmation: false,
};

const LOCATION_LABELS: Record<string, string> = {
  in_person: 'In Person',
  video: 'Video Call',
  phone: 'Phone Call',
  custom: 'Custom',
  ask_invitee: 'Ask Invitee',
};

const LOCATION_ICONS: Record<string, React.ElementType> = {
  in_person: MapPin,
  video: Video,
  phone: Phone,
  custom: MapPin,
  ask_invitee: MapPin,
};

const DURATION_PRESETS = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '2 hours', value: 120 },
  { label: '4 hours', value: 240 },
  { label: '1 day', value: 480 },
];


function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (minutes >= 480) return `${hours}h (full day)`;
  if (remaining === 0) return `${hours}h`;
  return `${hours}h ${remaining}m`;
}

export function BookingPresetsTab({ assetId }: { assetId: string }) {
  const { slug } = useParams<{ slug: string }>();
  const [presets, setPresets] = useState<EventTypePreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<EventTypePreset | null>(null);
  const [form, setForm] = useState<PresetFormData>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EventTypePreset | null>(null);
  const [deleting, setDeleting] = useState(false);

  const apiBase = `/api/projects/${slug}/community-assets/${assetId}/event-types`;

  const fetchPresets = useCallback(async () => {
    try {
      const res = await fetch(apiBase);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setPresets(data.event_types ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load booking presets');
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    void fetchPresets();
  }, [fetchPresets]);

  const openCreateDialog = () => {
    setEditingPreset(null);
    setForm(DEFAULT_FORM);
    setDialogOpen(true);
  };

  const openEditDialog = (preset: EventTypePreset) => {
    setEditingPreset(preset);
    setForm({
      title: preset.title,
      description: preset.description ?? '',
      duration_minutes: preset.duration_minutes,
      color: preset.color,
      location_type: preset.location_type,
      location_value: preset.location_value ?? '',
      buffer_before_minutes: preset.buffer_before_minutes,
      buffer_after_minutes: preset.buffer_after_minutes,
      min_notice_hours: preset.min_notice_hours,
      max_days_in_advance: preset.max_days_in_advance,
      requires_confirmation: preset.requires_confirmation,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error('Title is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        description: form.description || null,
        location_value: form.location_value || null,
      };

      if (editingPreset) {
        // Update
        const res = await fetch(apiBase, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event_type_id: editingPreset.id, ...payload }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update');
        toast.success('Booking option updated');
      } else {
        // Create
        const res = await fetch(apiBase, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create');
        toast.success('Booking option created');
      }

      setDialogOpen(false);
      void fetchPresets();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (preset: EventTypePreset) => {
    try {
      const res = await fetch(apiBase, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_type_id: preset.id, is_active: !preset.is_active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update');
      setPresets((prev) =>
        prev.map((p) => (p.id === preset.id ? { ...p, is_active: !p.is_active } : p))
      );
      toast.success(preset.is_active ? 'Booking option deactivated' : 'Booking option activated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to toggle');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`${apiBase}?event_type_id=${deleteTarget.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      if (data.deactivated) {
        toast.success('Booking option deactivated (has existing bookings)');
      } else {
        toast.success('Booking option deleted');
      }
      setDeleteTarget(null);
      void fetchPresets();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  const updateForm = <K extends keyof PresetFormData>(key: K, value: PresetFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading booking options...
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Booking Options</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Define how community members can book or borrow this asset. Each option appears as a
                choice on the public booking page.
              </p>
            </div>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Add Option
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {presets.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <CalendarClock className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <h3 className="mt-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                No booking options yet
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Set a booking owner in the Access tab to auto-generate default options, or add a
                custom option below.
              </p>
              <Button className="mt-4" onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Add Booking Option
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {presets.map((preset) => {
                const LocationIcon = LOCATION_ICONS[preset.location_type] ?? MapPin;
                return (
                  <div
                    key={preset.id}
                    className={`flex items-center gap-4 rounded-lg border p-4 transition-colors ${
                      preset.is_active
                        ? 'bg-white dark:bg-gray-900'
                        : 'bg-gray-50 opacity-60 dark:bg-gray-950'
                    }`}
                  >
                    <div
                      className="h-10 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: preset.color }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {preset.title}
                        </span>
                        {!preset.is_active && (
                          <Badge variant="secondary" className="text-xs">
                            Inactive
                          </Badge>
                        )}
                        {preset.requires_confirmation && (
                          <Badge variant="outline" className="text-xs">
                            Requires confirmation
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(preset.duration_minutes)}
                        </span>
                        <span className="flex items-center gap-1">
                          <LocationIcon className="h-3 w-3" />
                          {LOCATION_LABELS[preset.location_type] ?? preset.location_type}
                        </span>
                        {(preset.buffer_before_minutes > 0 || preset.buffer_after_minutes > 0) && (
                          <span>
                            Buffer: {preset.buffer_before_minutes}m before / {preset.buffer_after_minutes}m after
                          </span>
                        )}
                        <span>Book up to {preset.max_days_in_advance}d ahead</span>
                      </div>
                      {preset.description && (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                          {preset.description}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleToggleActive(preset)}
                        title={preset.is_active ? 'Deactivate' : 'Activate'}
                      >
                        <div
                          className={`h-2.5 w-2.5 rounded-full ${
                            preset.is_active ? 'bg-emerald-500' : 'bg-gray-300'
                          }`}
                        />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditDialog(preset)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(preset)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingPreset ? 'Edit Booking Option' : 'New Booking Option'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="preset-title">Title</Label>
              <Input
                id="preset-title"
                placeholder="e.g. Borrow for 1 day, Reserve for 2 hours"
                value={form.title}
                onChange={(e) => updateForm('title', e.target.value)}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="preset-desc">Description (optional)</Label>
              <Textarea
                id="preset-desc"
                placeholder="Describe what this booking option includes..."
                value={form.description}
                onChange={(e) => updateForm('description', e.target.value)}
                rows={2}
              />
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <Label>Duration</Label>
              <div className="flex flex-wrap gap-2">
                {DURATION_PRESETS.map((dp) => (
                  <Button
                    key={dp.value}
                    type="button"
                    variant={form.duration_minutes === dp.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateForm('duration_minutes', dp.value)}
                  >
                    {dp.label}
                  </Button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="custom-duration" className="shrink-0 text-xs text-muted-foreground">
                  Custom:
                </Label>
                <Input
                  id="custom-duration"
                  type="number"
                  min={5}
                  max={480}
                  value={form.duration_minutes}
                  onChange={(e) =>
                    updateForm(
                      'duration_minutes',
                      Math.max(5, Math.min(480, parseInt(e.target.value) || 30))
                    )
                  }
                  className="w-24"
                />
                <span className="text-xs text-muted-foreground">minutes</span>
              </div>
            </div>

            {/* Location Type */}
            <div className="space-y-2">
              <Label>Location Type</Label>
              <Select
                value={form.location_type}
                onValueChange={(val) => updateForm('location_type', val)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_person">In Person</SelectItem>
                  <SelectItem value="video">Video Call</SelectItem>
                  <SelectItem value="phone">Phone Call</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                  <SelectItem value="ask_invitee">Ask Invitee</SelectItem>
                </SelectContent>
              </Select>
              {(form.location_type === 'in_person' || form.location_type === 'custom') && (
                <Input
                  placeholder={
                    form.location_type === 'in_person'
                      ? 'e.g. 123 Main St or Room 4B'
                      : 'Location details...'
                  }
                  value={form.location_value}
                  onChange={(e) => updateForm('location_value', e.target.value)}
                />
              )}
            </div>

            {/* Color */}
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => updateForm('color', e.target.value)}
                  className="h-8 w-8 cursor-pointer rounded border"
                />
                <Input
                  value={form.color}
                  onChange={(e) => updateForm('color', e.target.value)}
                  className="w-28"
                />
              </div>
            </div>

            {/* Buffers */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="buffer-before">Buffer Before (min)</Label>
                <Input
                  id="buffer-before"
                  type="number"
                  min={0}
                  max={120}
                  value={form.buffer_before_minutes}
                  onChange={(e) =>
                    updateForm('buffer_before_minutes', Math.max(0, parseInt(e.target.value) || 0))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buffer-after">Buffer After (min)</Label>
                <Input
                  id="buffer-after"
                  type="number"
                  min={0}
                  max={120}
                  value={form.buffer_after_minutes}
                  onChange={(e) =>
                    updateForm('buffer_after_minutes', Math.max(0, parseInt(e.target.value) || 0))
                  }
                />
              </div>
            </div>

            {/* Scheduling limits */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="min-notice">Min Notice (hours)</Label>
                <Input
                  id="min-notice"
                  type="number"
                  min={0}
                  max={720}
                  value={form.min_notice_hours}
                  onChange={(e) =>
                    updateForm('min_notice_hours', Math.max(0, parseInt(e.target.value) || 0))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-advance">Max Days Ahead</Label>
                <Input
                  id="max-advance"
                  type="number"
                  min={1}
                  max={365}
                  value={form.max_days_in_advance}
                  onChange={(e) =>
                    updateForm('max_days_in_advance', Math.max(1, parseInt(e.target.value) || 60))
                  }
                />
              </div>
            </div>

            {/* Requires Confirmation */}
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="requires-confirmation">Require Confirmation</Label>
                <p className="text-xs text-muted-foreground">
                  Bookings need manual approval before being confirmed
                </p>
              </div>
              <Switch
                id="requires-confirmation"
                checked={form.requires_confirmation}
                onCheckedChange={(val) => updateForm('requires_confirmation', val)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingPreset ? 'Save Changes' : 'Create Option'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete booking option?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove &quot;{deleteTarget?.title}&quot; as a booking option. If there are
              existing bookings using this option, it will be deactivated instead of deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
