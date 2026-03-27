'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Globe } from 'lucide-react';

interface HubSettings {
  slug: string;
  title: string | null;
  description: string | null;
  logo_url: string | null;
  accent_color: string | null;
  is_enabled: boolean;
}

const DEFAULT_SETTINGS: HubSettings = {
  slug: '',
  title: null,
  description: null,
  logo_url: null,
  accent_color: null,
  is_enabled: false,
};

export function HubSettingsCard() {
  const { slug: projectSlug } = useParams<{ slug: string }>();
  const [settings, setSettings] = useState<HubSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(true);

  const apiPath = `/api/projects/${projectSlug}/community-assets/access-settings`;

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(apiPath);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load hub settings');
      }
      if (data.settings) {
        setSettings({
          slug: data.settings.slug ?? '',
          title: data.settings.title ?? null,
          description: data.settings.description ?? null,
          logo_url: data.settings.logo_url ?? null,
          accent_color: data.settings.accent_color ?? null,
          is_enabled: data.settings.is_enabled ?? false,
        });
        setIsNew(false);
      } else {
        setSettings(DEFAULT_SETTINGS);
        setIsNew(true);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load hub settings';
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  }, [apiPath]);

  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    if (!settings.slug.trim()) {
      toast.error('Hub slug is required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(apiPath, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: settings.slug.trim(),
          title: settings.title?.trim() || undefined,
          description: settings.description?.trim() || null,
          logo_url: settings.logo_url?.trim() || null,
          accent_color: settings.accent_color?.trim() || null,
          is_enabled: settings.is_enabled,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save hub settings');
      }
      if (data.settings) {
        setSettings({
          slug: data.settings.slug ?? '',
          title: data.settings.title ?? null,
          description: data.settings.description ?? null,
          logo_url: data.settings.logo_url ?? null,
          accent_color: data.settings.accent_color ?? null,
          is_enabled: data.settings.is_enabled ?? false,
        });
        setIsNew(false);
      }
      toast.success('Hub settings saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save hub settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading hub settings...
        </CardContent>
      </Card>
    );
  }

  if (loadError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Resource Hub Settings</CardTitle>
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
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Resource Hub Settings
            </CardTitle>
            <CardDescription>
              Configure the public resource hub where community members can browse and request access to assets.
            </CardDescription>
          </div>
          <Badge variant={settings.is_enabled ? 'default' : 'secondary'}>
            {settings.is_enabled ? 'Enabled' : 'Disabled'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {isNew && (
          <div className="rounded-md border border-blue-300 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-200">
            No hub has been configured yet. Fill in the slug below and save to create your public resource hub.
          </div>
        )}

        {/* Enable Hub */}
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="hub_enabled">Enable Hub</Label>
            <p className="text-sm text-muted-foreground">
              When enabled, the public resource hub is accessible to community members.
            </p>
          </div>
          <Switch
            id="hub_enabled"
            checked={settings.is_enabled}
            onCheckedChange={(val) => setSettings((prev) => ({ ...prev, is_enabled: val }))}
          />
        </div>

        {/* Hub Slug */}
        <div className="space-y-2">
          <Label htmlFor="hub_slug">Hub Slug</Label>
          <p className="text-sm text-muted-foreground">
            URL-safe identifier for the hub. Lowercase letters, numbers, and hyphens only.
          </p>
          <Input
            id="hub_slug"
            value={settings.slug}
            onChange={(e) => setSettings((prev) => ({ ...prev, slug: e.target.value }))}
            placeholder="e.g. community-resources"
          />
          {settings.slug && (
            <p className="text-xs text-muted-foreground">
              Public URL: /hub/{settings.slug}
            </p>
          )}
        </div>

        {/* Hub Title */}
        <div className="space-y-2">
          <Label htmlFor="hub_title">Hub Title</Label>
          <Input
            id="hub_title"
            value={settings.title ?? ''}
            onChange={(e) => setSettings((prev) => ({ ...prev, title: e.target.value || null }))}
            placeholder="e.g. Community Resource Hub"
          />
        </div>

        {/* Hub Description */}
        <div className="space-y-2">
          <Label htmlFor="hub_description">Description</Label>
          <Textarea
            id="hub_description"
            value={settings.description ?? ''}
            onChange={(e) => setSettings((prev) => ({ ...prev, description: e.target.value || null }))}
            rows={3}
            placeholder="A brief description shown on the public hub page"
          />
        </div>

        {/* Logo URL */}
        <div className="space-y-2">
          <Label htmlFor="hub_logo_url">Logo URL</Label>
          <Input
            id="hub_logo_url"
            value={settings.logo_url ?? ''}
            onChange={(e) => setSettings((prev) => ({ ...prev, logo_url: e.target.value || null }))}
            placeholder="https://example.com/logo.png"
          />
        </div>

        {/* Accent Color */}
        <div className="space-y-2">
          <Label htmlFor="hub_accent_color">Accent Color</Label>
          <Input
            id="hub_accent_color"
            value={settings.accent_color ?? ''}
            onChange={(e) => setSettings((prev) => ({ ...prev, accent_color: e.target.value || null }))}
            placeholder="#3b82f6"
          />
        </div>

        {/* Save */}
        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={saving || !settings.slug.trim()}>
            {saving ? 'Saving...' : isNew ? 'Create Hub' : 'Save Settings'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
