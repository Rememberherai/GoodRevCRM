'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

interface AccessSettings {
  access_mode: string;
  access_enabled: boolean;
  approval_policy: string;
  concurrent_capacity: number;
  booking_owner_user_id: string | null;
  return_required: boolean;
  resource_slug: string | null;
  public_name: string | null;
  public_description: string | null;
  public_visibility: string;
  access_instructions: string | null;
}

  interface HubInfo {
  slug: string;
  is_enabled: boolean;
}

const DEFAULT_SETTINGS: AccessSettings = {
  access_mode: 'tracked_only',
  access_enabled: false,
  approval_policy: 'open_auto',
  concurrent_capacity: 1,
  booking_owner_user_id: null,
  return_required: false,
  resource_slug: null,
  public_name: null,
  public_description: null,
  public_visibility: 'unlisted',
  access_instructions: null,
};

export function AccessSettingsTab({ assetId }: { assetId: string }) {
  const { slug } = useParams<{ slug: string }>();
  const [settings, setSettings] = useState<AccessSettings>(DEFAULT_SETTINGS);
  const [hub, setHub] = useState<HubInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(
        `/api/projects/${slug}/community-assets/${assetId}/access-settings`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load access settings');
      }
      setSettings(data.settings);
      setHub(data.hub ?? null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load access settings';
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [slug, assetId]);

  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/projects/${slug}/community-assets/${assetId}/access-settings`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settings),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save');
      }
      const data = await res.json().catch(() => ({}));
      if (data.asset) {
        setSettings((prev) => ({
          ...prev,
          ...data.asset,
        }));
      }
      toast.success('Access settings saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save access settings');
    } finally {
      setSaving(false);
    }
  };

  const update = <K extends keyof AccessSettings>(key: K, value: AccessSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading access settings...
        </CardContent>
      </Card>
    );
  }

  if (loadError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Access Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {loadError}
          </div>
          <Button variant="outline" onClick={() => void fetchSettings()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Access Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {(!hub || !hub.is_enabled) && (
          <div className="rounded-md border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-200">
            <strong>{hub ? 'Hub disabled.' : 'Hub not configured.'}</strong> A project admin needs to set up and enable the
            community hub before public access features can be used.
          </div>
        )}

        {/* Enable Access */}
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="access_enabled">Enable Access</Label>
            <p className="text-sm text-muted-foreground">
              Allow community members to access this asset
            </p>
          </div>
          <Switch
            id="access_enabled"
            checked={settings.access_enabled}
            onCheckedChange={(val) => update('access_enabled', val)}
          />
        </div>

        {/* Access Mode */}
        <div className="space-y-2">
          <Label>Access Mode</Label>
          <Select
            value={settings.access_mode}
            onValueChange={(val) => update('access_mode', val)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tracked_only">Tracked Only</SelectItem>
              <SelectItem value="reservable">Reservable</SelectItem>
              <SelectItem value="loanable">Loanable</SelectItem>
              <SelectItem value="hybrid">Hybrid</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Approval Policy */}
        <div className="space-y-2">
          <Label>Approval Policy</Label>
          <Select
            value={settings.approval_policy}
            onValueChange={(val) => update('approval_policy', val)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open_auto">Auto-approve</SelectItem>
              <SelectItem value="open_review">Requires Review</SelectItem>
              <SelectItem value="approved_only">Pre-approved Only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Concurrent Capacity */}
        <div className="space-y-2">
          <Label htmlFor="concurrent_capacity">Concurrent Capacity</Label>
          <Input
            id="concurrent_capacity"
            type="number"
            min={1}
            value={settings.concurrent_capacity}
            onChange={(e) =>
              update('concurrent_capacity', Math.max(1, parseInt(e.target.value) || 1))
            }
          />
        </div>

        {/* Return Required */}
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="return_required">Require Return</Label>
            <p className="text-sm text-muted-foreground">
              Require the asset to be returned after use
            </p>
          </div>
          <Switch
            id="return_required"
            checked={settings.return_required}
            onCheckedChange={(val) => update('return_required', val)}
          />
        </div>

        {/* Booking Owner User ID */}
        <div className="space-y-2">
          <Label htmlFor="booking_owner_user_id">Booking Owner User ID</Label>
          <p className="text-sm text-muted-foreground">
            UUID of the user responsible for managing bookings
          </p>
          <Input
            id="booking_owner_user_id"
            value={settings.booking_owner_user_id ?? ''}
            onChange={(e) => update('booking_owner_user_id', e.target.value || null)}
            placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
          />
        </div>

        {/* Resource Slug */}
        <div className="space-y-2">
          <Label htmlFor="resource_slug">Public URL Slug</Label>
          <Input
            id="resource_slug"
            value={settings.resource_slug ?? ''}
            onChange={(e) => update('resource_slug', e.target.value || null)}
            placeholder="e.g. conference-room-a"
          />
        </div>

        {/* Public Name */}
        <div className="space-y-2">
          <Label htmlFor="public_name">Public Name</Label>
          <Input
            id="public_name"
            value={settings.public_name ?? ''}
            onChange={(e) => update('public_name', e.target.value || null)}
          />
        </div>

        {/* Public Description */}
        <div className="space-y-2">
          <Label htmlFor="public_description">Public Description</Label>
          <Textarea
            id="public_description"
            value={settings.public_description ?? ''}
            onChange={(e) => update('public_description', e.target.value || null)}
            rows={3}
          />
        </div>

        {/* Public Visibility */}
        <div className="space-y-2">
          <Label>Public Visibility</Label>
          <Select
            value={settings.public_visibility}
            onValueChange={(val) => update('public_visibility', val)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="listed">Listed</SelectItem>
              <SelectItem value="unlisted">Unlisted</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Access Instructions */}
        <div className="space-y-2">
          <Label htmlFor="access_instructions">Access Instructions</Label>
          <Textarea
            id="access_instructions"
            value={settings.access_instructions ?? ''}
            onChange={(e) => update('access_instructions', e.target.value || null)}
            rows={3}
            placeholder="Instructions shown to users after their access is approved"
          />
        </div>

        {/* Save */}
        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
