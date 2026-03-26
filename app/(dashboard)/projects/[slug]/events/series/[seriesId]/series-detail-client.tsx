'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CalendarDays, MapPin, Monitor, Plus, Repeat, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { SeriesReportView } from '@/components/community/reports/series-report';
import type { SeriesReport } from '@/lib/community/reports';

interface SeriesDetail {
  id: string;
  title: string;
  description: string | null;
  status: string;
  recurrence_frequency: string;
  recurrence_days_of_week: string[] | null;
  recurrence_day_positions: number[] | null;
  generation_status: string;
  generation_progress: number | null;
  generation_total: number | null;
  recurrence_until: string | null;
  recurrence_count: number | null;
  template_start_time: string;
  template_end_time: string;
  timezone: string;
  location_type: string;
  venue_name: string | null;
  virtual_url: string | null;
  program_id: string | null;
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
  const [reportData, setReportData] = useState<SeriesReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportLoaded, setReportLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const apiBase = `/api/projects/${slug}/events/series/${seriesId}`;

  const loadSeries = useCallback(async (silent = false) => {
    try {
      const res = await fetch(apiBase);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSeries(data.series);
    } catch (err) {
      if (!silent) {
        toast.error(err instanceof Error ? err.message : 'Failed to load series');
      }
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

  // Poll for generation progress
  useEffect(() => {
    if (series?.generation_status !== 'generating') return;
    const interval = setInterval(() => {
      void loadSeries(true);
      void loadInstances();
    }, 2000);
    return () => clearInterval(interval);
  }, [series?.generation_status, loadSeries, loadInstances]);

  async function handleGenerate() {
    setIsGenerating(true);
    try {
      const res = await fetch(`${apiBase}/generate`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(`Generated ${data.instances_generated} new instances`);
      setReportData(null);
      setReportLoaded(false);
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

  const loadReport = useCallback(async () => {
    if (reportLoaded) return;
    setReportLoading(true);
    try {
      const res = await fetch(`/api/projects/${slug}/community/reports?type=series_report&seriesId=${seriesId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load report');
      setReportData(data.series_report ?? null);
      setReportLoaded(true);
    } catch (err) {
      setReportData(null);
      setReportLoaded(false);
      toast.error(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setReportLoading(false);
    }
  }, [slug, seriesId, reportLoaded]);

  useEffect(() => {
    if (activeTab === 'report' && !reportLoaded && !reportLoading) {
      void loadReport();
    }
  }, [activeTab, reportLoaded, reportLoading, loadReport]);

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
    if (series.recurrence_day_positions?.length) {
      const posLabels = ['', '1st', '2nd', '3rd', '4th', 'last'];
      const dayNames: Record<string, string> = { MO: 'Monday', TU: 'Tuesday', WE: 'Wednesday', TH: 'Thursday', FR: 'Friday', SA: 'Saturday', SU: 'Sunday' };
      const positions = series.recurrence_day_positions.map(p => posLabels[p] || '').filter(Boolean).join(' & ');
      const dayLabel = dayNames[series.recurrence_days_of_week?.[0] ?? ''] ?? series.recurrence_days_of_week?.[0] ?? '';
      summary = `${positions} ${dayLabel} monthly`;
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
          <Button variant="outline" size="sm" onClick={handleGenerate} disabled={isGenerating || series.generation_status === 'generating'}>
            <Plus className="mr-1 h-3 w-3" />{isGenerating || series.generation_status === 'generating' ? 'Generating...' : 'Generate More'}
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="mr-1 h-3 w-3" />Delete Series
          </Button>
        </div>
      </div>

      {/* Generation progress banner */}
      {series.generation_status === 'generating' && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
              Generating event instances...
            </p>
            <p className="text-sm text-blue-600 dark:text-blue-400">
              {series.generation_progress ?? 0} / {series.generation_total ?? 0}
            </p>
          </div>
          <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
            <div
              className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all duration-500"
              style={{ width: `${series.generation_total ? Math.round(((series.generation_progress ?? 0) / series.generation_total) * 100) : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Tabs: Overview + Report */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="report">Report</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 pt-4">
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
                    <p>{instances.length}</p>
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
        </TabsContent>

        <TabsContent value="report" className="pt-4">
          {reportLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-pulse space-y-4 w-full">
                <div className="h-8 w-64 bg-muted rounded" />
                <div className="h-40 bg-muted rounded-xl" />
              </div>
            </div>
          ) : (
            <SeriesReportView data={reportData} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
