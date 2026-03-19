'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { CalendarProfile } from '@/types/calendar';

export default function CalendarSettingsPage() {
  const [profile, setProfile] = useState<CalendarProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [origin, setOrigin] = useState('');

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
      const method = profile ? 'PUT' : 'POST';
      const body = profile
        ? {
            slug: form.slug,
            display_name: form.display_name,
            bio: form.bio || null,
            timezone: form.timezone,
            welcome_message: form.welcome_message || null,
          }
        : {
            slug: form.slug,
            display_name: form.display_name,
            bio: form.bio || null,
            timezone: form.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
            welcome_message: form.welcome_message || null,
          };

      const res = await fetch('/api/calendar/profile', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.toString() || 'Failed to save');
        return;
      }

      const data = await res.json();
      setProfile(data.profile);
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
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
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
              <Input
                id="timezone"
                value={form.timezone}
                onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
                placeholder="America/New_York"
              />
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
