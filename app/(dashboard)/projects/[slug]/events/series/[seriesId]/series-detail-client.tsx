'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CalendarDays, MapPin, Monitor, Plus, Repeat, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface SeriesDetail {
  id: string;
  title: string;
  description: string | null;
  status: string;
  recurrence_frequency: string;
  recurrence_days_of_week: string[] | null;
  recurrence_day_position: number | null;
  recurrence_until: string | null;
  recurrence_count: number | null;
  template_start_time: string;
  template_end_time: string;
  timezone: string;
  location_type: string;
  venue_name: string | null;
  virtual_url: string | null;
  program_id: string | null;
  instance_count: number;
}

interface EventInstance {
  id: string;
  title: string;
  slug: string;
  status: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
}

interface SeriesRegistration {
  id: string;
  registrant_name: string;
  registrant_email: string;
  status: string;
  created_at: string;
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  active: 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200',
  paused: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200',
  completed: 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-200',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200',
};

export function SeriesDetailClient() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const seriesId = params.seriesId as string;

  const [series, setSeries] = useState<SeriesDetail | null>(null);
  const [instances, setInstances] = useState<EventInstance[]>([]);
  const [registrations, setRegistrations] = useState<SeriesRegistration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const apiBase = `/api/projects/${slug}/events/series/${seriesId}`;

  const loadSeries = useCallback(async () => {
    try {
      const res = await fetch(apiBase);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSeries(data.series);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load series');
    } finally {
      setIsLoading(false);
    }
  }, [apiBase]);

  const loadInstances = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${slug}/events?seriesId=${seriesId}&limit=200&sortBy=starts_at&sortOrder=asc`);
      const data = await res.json();
      if (res.ok) {
        setInstances(data.events ?? []);
      }
    } catch {
      console.error('Failed to load instances');
    }
  }, [slug, seriesId]);

  const loadRegistrations = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/registrations?limit=50`);
      const data = await res.json();
      if (res.ok) setRegistrations(data.registrations ?? []);
    } catch {
      console.error('Failed to load series registrations');
    }
  }, [apiBase]);

  useEffect(() => {
    void loadSeries();
    void loadInstances();
    void loadRegistrations();
  }, [loadSeries, loadInstances, loadRegistrations]);

  async function handleGenerate() {
    setIsGenerating(true);
    try {
      const res = await fetch(`${apiBase}/generate`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(`Generated ${data.instances_generated} new instances`);
      void loadSeries();
      void loadInstances();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate');
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this series and all its events?')) return;
    try {
      const res = await fetch(apiBase, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed');
      }
      toast.success('Series deleted');
      router.push(`/projects/${slug}/events`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    }
  }

  function formatDate(iso: string, tz?: string) {
    return new Date(iso).toLocaleDateString('en-US', {
      timeZone: tz || series?.timezone || 'America/Denver',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  function recurrenceSummary() {
    if (!series) return '';
    let summary = series.recurrence_frequency;
    if (series.recurrence_days_of_week?.length) {
      summary += ` on ${series.recurrence_days_of_week.join(', ')}`;
    }
    if (series.recurrence_day_position) {
      const pos = ['', '1st', '2nd', '3rd', '4th', '5th'][series.recurrence_day_position] || '';
      summary = `${pos} ${series.recurrence_days_of_week?.[0] ?? ''} monthly`;
    }
    return summary;
  }

  if (isLoading) return <div className="animate-pulse space-y-4"><div className="h-8 w-64 bg-muted rounded" /><div className="h-40 bg-muted rounded-xl" /></div>;
  if (!series) return <div className="text-center py-12 text-muted-foreground">Series not found</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/projects/${slug}/events`}>
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Repeat className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-2xl font-bold">{series.title}</h2>
              <Badge className={statusColors[series.status] ?? ''}>{series.status}</Badge>
            </div>
            <p className="text-sm text-muted-foreground capitalize">{recurrenceSummary()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleGenerate} disabled={isGenerating}>
            <Plus className="mr-1 h-3 w-3" />{isGenerating ? 'Generating...' : 'Generate More'}
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="mr-1 h-3 w-3" />Delete Series
          </Button>
        </div>
      </div>

      {/* Info */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Series Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {series.description && <p className="text-muted-foreground">{series.description}</p>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-muted-foreground">Frequency:</span>
                <p className="capitalize">{recurrenceSummary()}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Time:</span>
                <p>{series.template_start_time} – {series.template_end_time}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Location:</span>
                <p className="flex items-center gap-1">
                  {series.location_type === 'virtual' ? <><Monitor className="h-3 w-3" />Virtual</> : <><MapPin className="h-3 w-3" />{series.venue_name ?? 'TBD'}</>}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Instances:</span>
                <p>{series.instance_count}</p>
              </div>
              {series.recurrence_until && (
                <div>
                  <span className="text-muted-foreground">Until:</span>
                  <p>{new Date(series.recurrence_until).toLocaleDateString()}</p>
                </div>
              )}
              {series.recurrence_count && (
                <div>
                  <span className="text-muted-foreground">Max Count:</span>
                  <p>{series.recurrence_count}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />Series Registrations
            </CardTitle>
          </CardHeader>
          <CardContent>
            {registrations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">No series registrations.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto text-sm">
                {registrations.map(reg => (
                  <div key={reg.id} className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{reg.registrant_name}</p>
                      <p className="text-xs text-muted-foreground">{reg.registrant_email}</p>
                    </div>
                    <Badge variant="secondary">{reg.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Instances */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Event Instances</CardTitle>
          <CardDescription>All events generated from this series.</CardDescription>
        </CardHeader>
        <CardContent>
          {instances.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No instances yet. Click &ldquo;Generate More&rdquo; to create events.</p>
          ) : (
            <div className="space-y-2">
              {instances.map(evt => (
                <Link key={evt.id} href={`/projects/${slug}/events/${evt.id}`} className="block">
                  <div className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                    <div>
                      <p className="font-medium">{evt.title}</p>
                      <p className="text-sm text-muted-foreground">{formatDate(evt.starts_at, evt.timezone)}</p>
                    </div>
                    <Badge variant="secondary" className={statusColors[evt.status] ?? ''}>{evt.status}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
