'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
import { Check, Globe, Loader2 } from 'lucide-react';

interface HubSettings {
  slug: string;
  title: string | null;
  description: string | null;
  accent_color: string | null;
  is_enabled: boolean;
}

const DEFAULT_SETTINGS: HubSettings = {
  slug: '',
  title: null,
  description: null,
  accent_color: null,
  is_enabled: false,
};

export function HubSettingsCard() {
  const { slug: projectSlug } = useParams<{ slug: string }>();
  const [settings, setSettings] = useState<HubSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(true);

  // Track the last-saved snapshot to detect changes
  const lastSavedRef = useRef<string>('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        const loaded: HubSettings = {
          slug: data.settings.slug ?? '',
          title: data.settings.title ?? null,
          description: data.settings.description ?? null,
          accent_color: data.settings.accent_color ?? null,
          is_enabled: data.settings.is_enabled ?? false,
        };
        setSettings(loaded);
        lastSavedRef.current = JSON.stringify(loaded);
        setIsNew(false);
      } else {
        setSettings(DEFAULT_SETTINGS);
        lastSavedRef.current = JSON.stringify(DEFAULT_SETTINGS);
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

  const doSave = useCallback(async (settingsToSave: HubSettings) => {
    if (!settingsToSave.slug.trim()) return;
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(apiPath, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: settingsToSave.slug.trim(),
          title: settingsToSave.title?.trim() || undefined,
          description: settingsToSave.description?.trim() || null,
          accent_color: settingsToSave.accent_color?.trim() || null,
          is_enabled: settingsToSave.is_enabled,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save hub settings');
      }
      if (data.settings) {
        const saved: HubSettings = {
          slug: data.settings.slug ?? '',
          title: data.settings.title ?? null,
          description: data.settings.description ?? null,
          accent_color: data.settings.accent_color ?? null,
          is_enabled: data.settings.is_enabled ?? false,
        };
        lastSavedRef.current = JSON.stringify(saved);
        setIsNew(false);
      }
      setSaved(true);
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
      savedTimeoutRef.current = setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save hub settings');
    } finally {
      setSaving(false);
    }
  }, [apiPath]);

  // Debounced autosave — only after initial creation
  useEffect(() => {
    if (loading || isNew) return;
    const currentSnapshot = JSON.stringify(settings);
    if (currentSnapshot === lastSavedRef.current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void doSave(settings);
    }, 1500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [settings, loading, isNew, doSave]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    };
  }, []);

  const handleCreate = async () => {
    if (!settings.slug.trim()) {
      toast.error('Hub slug is required');
      return;
    }
    await doSave(settings);
    toast.success('Hub created');
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
          <div className="flex items-center gap-2">
            {!isNew && (saving || saved) && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {saving ? (
                  <><Loader2 className="h-3 w-3 animate-spin" /> Saving...</>
                ) : (
                  <><Check className="h-3 w-3 text-emerald-500" /> Saved</>
                )}
              </span>
            )}
            <Badge variant={settings.is_enabled ? 'default' : 'secondary'}>
              {settings.is_enabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>
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

        {/* Accent Color */}
        <div className="space-y-2">
          <Label htmlFor="hub_accent_color">Accent Color</Label>
          <p className="text-sm text-muted-foreground">
            Brand color used on the public hub page.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="color"
              id="hub_accent_color"
              value={settings.accent_color ?? '#3b82f6'}
              onChange={(e) => setSettings((prev) => ({ ...prev, accent_color: e.target.value }))}
              className="h-10 w-14 cursor-pointer rounded-md border border-input p-1"
            />
            <Input
              value={settings.accent_color ?? ''}
              onChange={(e) => setSettings((prev) => ({ ...prev, accent_color: e.target.value || null }))}
              placeholder="#3b82f6"
              className="max-w-[140px] font-mono text-sm"
            />
            {settings.accent_color && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSettings((prev) => ({ ...prev, accent_color: null }))}
                className="text-muted-foreground"
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Create button — only shown for new hubs */}
        {isNew && (
          <div className="flex justify-end pt-2">
            <Button onClick={handleCreate} disabled={saving || !settings.slug.trim()}>
              {saving ? 'Creating...' : 'Create Hub'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
