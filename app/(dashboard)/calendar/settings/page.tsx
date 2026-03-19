'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Clock3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { CalendarProfile } from '@/types/calendar';
import { cn } from '@/lib/utils';
import { formatTimezoneLabel, getSupportedTimezones } from '@/lib/calendar/timezones';

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-');
}

function extractErrorMessage(payload: unknown): string {
  if (typeof payload === 'string' && payload) {
    return payload;
  }

  if (!payload || typeof payload !== 'object') {
    return 'Failed to save';
  }

  const data = payload as {
    error?: unknown;
    details?: {
      formErrors?: string[];
      fieldErrors?: Record<string, string[] | undefined>;
    };
  };

  if (typeof data.error === 'string' && data.error !== 'Validation failed') {
    return data.error;
  }

  const formError = data.details?.formErrors?.find(Boolean);
  if (formError) {
    return formError;
  }

  const fieldErrors = data.details?.fieldErrors ?? {};
  for (const messages of Object.values(fieldErrors)) {
    const firstMessage = messages?.find(Boolean);
    if (firstMessage) {
      return firstMessage;
    }
  }

  if (typeof data.error === 'string' && data.error) {
    return data.error;
  }

  return 'Failed to save';
}

export default function CalendarSettingsPage() {
  const [profile, setProfile] = useState<CalendarProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [origin, setOrigin] = useState('');
  const [timezoneOpen, setTimezoneOpen] = useState(false);
  const browserTimezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
    []
  );
  const timezones = useMemo(() => getSupportedTimezones(), []);

  // Create form state
  const [form, setForm] = useState({
    slug: '',
    display_name: '',
    bio: '',
    timezone: '',
    welcome_message: '',
  });

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    setForm((current) => (
      current.timezone ? current : { ...current, timezone: browserTimezone }
    ));
  }, [browserTimezone]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/calendar/profile');
        if (res.ok && !cancelled) {
          const data = await res.json();
          if (data.profile) {
            setProfile(data.profile);
            setForm({
              slug: data.profile.slug || '',
              display_name: data.profile.display_name || '',
              bio: data.profile.bio || '',
              timezone: data.profile.timezone || '',
              welcome_message: data.profile.welcome_message || '',
            });
          }
        }
      } catch {
        // Silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.slug.trim()) {
      setError('URL Slug is required.');
      return;
    }
    if (!form.display_name.trim()) {
      setError('Display Name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const normalizedSlug = normalizeSlug(form.slug);
      const method = profile ? 'PUT' : 'POST';
      const body = profile
        ? {
            slug: normalizedSlug,
            display_name: form.display_name.trim(),
            bio: form.bio.trim() || null,
            timezone: form.timezone.trim(),
            welcome_message: form.welcome_message.trim() || null,
          }
        : {
            slug: normalizedSlug,
            display_name: form.display_name.trim(),
            bio: form.bio.trim() || null,
            timezone: form.timezone.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone,
            welcome_message: form.welcome_message.trim() || null,
          };

      setForm((current) => ({ ...current, slug: normalizedSlug }));

      const res = await fetch('/api/calendar/profile', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(extractErrorMessage(data));
        return;
      }

      setProfile(data.profile);
      setForm({
        slug: data.profile.slug || normalizedSlug,
        display_name: data.profile.display_name || body.display_name,
        bio: data.profile.bio || '',
        timezone: data.profile.timezone || body.timezone,
        welcome_message: data.profile.welcome_message || '',
      });
      setSuccess(true);
    } catch {
      setError('An error occurred');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6 text-muted-foreground">Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Calendar Settings</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Booking Page Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="slug">URL Slug</Label>
              <Input
                id="slug"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: normalizeSlug(e.target.value) }))}
                placeholder="john-doe"
                required
              />
              <p className="text-xs text-muted-foreground">
                Your booking page: {origin}/book/{form.slug || 'your-slug'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="display_name">Display Name</Label>
              <Input
                id="display_name"
                value={form.display_name}
                onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                placeholder="John Doe"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={form.bio}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                placeholder="A short bio for your booking page..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Popover open={timezoneOpen} onOpenChange={setTimezoneOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="timezone"
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={timezoneOpen}
                    className="w-full justify-between font-normal"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Clock3 className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className={cn('truncate', !form.timezone && 'text-muted-foreground')}>
                        {form.timezone ? formatTimezoneLabel(form.timezone) : 'Select timezone'}
                      </span>
                    </span>
                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search timezones..." />
                    <CommandList>
                      <CommandEmpty>No timezone found.</CommandEmpty>
                      <CommandGroup>
                        {timezones.map((timezone) => (
                          <CommandItem
                            key={timezone}
                            value={`${timezone} ${formatTimezoneLabel(timezone)}`}
                            onSelect={() => {
                              setForm((current) => ({ ...current, timezone }));
                              setTimezoneOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                form.timezone === timezone ? 'opacity-100' : 'opacity-0'
                              )}
                            />
                            <div className="flex min-w-0 flex-col">
                              <span className="truncate">{formatTimezoneLabel(timezone)}</span>
                              <span className="text-xs text-muted-foreground">{timezone}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">
                Used for your default availability and public booking page times.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="welcome_message">Welcome Message</Label>
              <Textarea
                id="welcome_message"
                value={form.welcome_message}
                onChange={(e) => setForm((f) => ({ ...f, welcome_message: e.target.value }))}
                placeholder="Welcome message shown on your booking page..."
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {success && <p className="text-sm text-green-600">Settings saved successfully.</p>}

        <Button type="submit" disabled={saving}>
          {saving ? 'Saving...' : profile ? 'Save Settings' : 'Create Profile'}
        </Button>
      </form>
    </div>
  );
}
