'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ExternalLink, Palette, Save, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { LogoUpload } from '@/components/ui/logo-upload';

interface EventCalendarSettings {
  is_enabled: boolean;
  slug: string;
  title: string;
  description: string | null;
  logo_url: string | null;
  primary_color: string;
  timezone: string;
}

const DEFAULT_SETTINGS: EventCalendarSettings = {
  is_enabled: false,
  slug: '',
  title: 'Events',
  description: '',
  logo_url: '',
  primary_color: '#3b82f6',
  timezone: 'America/Denver',
};

export default function EventSettingsPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [settings, setSettings] = useState<EventCalendarSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        const response = await fetch(`/api/projects/${slug}/events/calendar-settings`);
        const data = await response.json() as { settings?: Partial<EventCalendarSettings> | null; error?: string };
        if (!response.ok) throw new Error(data.error ?? 'Failed to load settings');

        setSettings({
          ...DEFAULT_SETTINGS,
          slug,
          ...data.settings,
          description: data.settings?.description ?? '',
          logo_url: data.settings?.logo_url ?? '',
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to load settings');
      } finally {
        setIsLoading(false);
      }
    }

    void loadSettings();
  }, [slug]);

  const previewHref = useMemo(() => {
    if (!settings.slug.trim()) return null;
    return `/events/${settings.slug.trim()}`;
  }, [settings.slug]);

  async function handleSave() {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/projects/${slug}/events/calendar-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_enabled: settings.is_enabled,
          slug: settings.slug.trim(),
          title: settings.title.trim() || 'Events',
          description: settings.description?.trim() || null,
          logo_url: settings.logo_url?.trim() || null,
          primary_color: settings.primary_color,
          timezone: settings.timezone.trim() || 'America/Denver',
        }),
      });

      const data = await response.json() as { settings?: Partial<EventCalendarSettings>; error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Failed to save settings');

      setSettings((current) => ({
        ...current,
        ...data.settings,
        description: data.settings?.description ?? '',
        logo_url: data.settings?.logo_url ?? '',
      }));
      toast.success('Event calendar settings updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Settings2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Event Settings</h2>
            <p className="text-sm text-muted-foreground">Configure the public events calendar for this project.</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={isLoading || isSaving}>
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Public Calendar</CardTitle>
          <CardDescription>Control branding, routing, and availability for the public events calendar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-1">
              <Label htmlFor="is_enabled">Enable events calendar</Label>
              <p className="text-sm text-muted-foreground">Allow public visitors to browse and register for events.</p>
            </div>
            <Switch
              id="is_enabled"
              checked={settings.is_enabled}
              onCheckedChange={(checked) => setSettings((current) => ({ ...current, is_enabled: checked }))}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="calendar_slug">Calendar Slug</Label>
              <Input
                id="calendar_slug"
                value={settings.slug}
                onChange={(event) => setSettings((current) => ({ ...current, slug: event.target.value.toLowerCase() }))}
                placeholder="community-events"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="calendar_title">Title</Label>
              <Input
                id="calendar_title"
                value={settings.title}
                onChange={(event) => setSettings((current) => ({ ...current, title: event.target.value }))}
                placeholder="Events"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="calendar_description">Description</Label>
            <Textarea
              id="calendar_description"
              value={settings.description ?? ''}
              onChange={(event) => setSettings((current) => ({ ...current, description: event.target.value }))}
              rows={3}
              placeholder="Tell visitors what kinds of events they’ll find here."
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Calendar Logo</Label>
              <div className="flex items-center gap-4">
                <LogoUpload
                  currentUrl={settings.logo_url}
                  fallbackInitials={(settings.title || 'EV').slice(0, 2).toUpperCase()}
                  entityType="calendar"
                  onUploaded={(url) => setSettings((current) => ({ ...current, logo_url: url }))}
                  size="lg"
                />
                <div className="flex-1 space-y-1">
                  <p className="text-sm text-muted-foreground">Click the icon to upload a logo, or paste a URL below.</p>
                  <Input
                    id="logo_url"
                    value={settings.logo_url ?? ''}
                    onChange={(event) => setSettings((current) => ({ ...current, logo_url: event.target.value }))}
                    placeholder="https://..."
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Input
                id="timezone"
                value={settings.timezone}
                onChange={(event) => setSettings((current) => ({ ...current, timezone: event.target.value }))}
                placeholder="America/Detroit"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[180px_1fr]">
            <div className="space-y-2">
              <Label htmlFor="primary_color" className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Primary Color
              </Label>
              <Input
                id="primary_color"
                type="color"
                value={settings.primary_color}
                onChange={(event) => setSettings((current) => ({ ...current, primary_color: event.target.value }))}
                className="h-11 p-1"
              />
            </div>
            <div className="rounded-xl border p-4" style={{ borderColor: settings.primary_color }}>
              <div className="text-sm font-medium">Preview</div>
              <div className="mt-2 flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white"
                  style={{ backgroundColor: settings.primary_color }}
                >
                  {(settings.title || 'EV').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="font-medium">{settings.title || 'Events'}</div>
                  <div className="text-sm text-muted-foreground">{settings.description || 'Public calendar preview'}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-dashed p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="font-medium">Preview Link</div>
                <div className="text-sm text-muted-foreground">
                  {previewHref ? previewHref : 'Set a calendar slug to generate the public URL.'}
                </div>
              </div>
              {previewHref && (
                <Button variant="outline" asChild>
                  <Link href={previewHref} target="_blank">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open Calendar
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
